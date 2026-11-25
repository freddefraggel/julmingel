import { useEffect, useId, useMemo, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import {
  loadPreparation,
  newConfigId,
  removeAsset,
  savePreparation,
  setAnswerImage,
  setGloggImage,
  subscribeAssets,
} from '../data'
import type { Choice, GuestClass, Phase } from '../types'
import { Button, Card, Tabs } from '../ui'
import { readAdminEventId } from './adminEvent'
import { ImageField } from './ImageField'
import { QuizCard } from './QuizCard'
import { RowActions } from './RowActions'
import { SpotifySetup } from './SpotifySetup'
import {
  CLASS_LABEL,
  CLASSES,
  move,
  problems,
  toDraft,
  toPayload,
  unusedImages,
  withDefaultCriteria,
  type Draft,
  type DraftCriterion,
  type DraftGlogg,
  type Saved,
} from './preparation'
import './prepare.css'

type Load = { kind: 'loading' } | { kind: 'failed' } | { kind: 'ready'; saved: Saved; baseline: Draft; phase: Phase | null }
type SaveStatus = { kind: 'idle' } | { kind: 'saving' } | { kind: 'saved' } | { kind: 'error'; messages: string[] }

/** Förbered kvällen (#/admin/forbered): kvällens namn och kod, glögger per klass, kriterier, låtar och quizfrågor. */
export default function PrepareEvening() {
  const { search } = useLocation()
  const eventId = useMemo(() => readAdminEventId(search), [search])

  if (!eventId) {
    return (
      <main className="page page--admin admin-center">
        <Card className="admin-login">
          <h1>Förbered kvällen</h1>
          <p className="muted">Välj först vilken kväll du vill förbereda.</p>
          <Link to="/admin" className="btn btn--secondary btn--small">
            Till kontrollpanelen
          </Link>
        </Card>
      </main>
    )
  }
  return <Prepare eventId={eventId} />
}

function Prepare({ eventId }: { eventId: string }) {
  const [load, setLoad] = useState<Load>({ kind: 'loading' })
  const [draft, setDraft] = useState<Draft | null>(null)
  const [assets, setAssets] = useState<Record<string, string>>({})
  const [status, setStatus] = useState<SaveStatus>({ kind: 'idle' })
  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    let active = true
    setLoad({ kind: 'loading' })
    loadPreparation(eventId)
      .then(({ config, joinCode, numbers, correct, phase }) => {
        if (!active) return
        const saved: Saved = { config, joinCode, numbers, correct }
        const baseline = toDraft(saved, eventId)
        setLoad({ kind: 'ready', saved, baseline, phase })
        // Designens kriterier finns alltid med; de sparas med nästa Spara.
        setDraft(withDefaultCriteria(baseline, () => newConfigId(eventId, 'criteria')))
      })
      .catch(() => {
        if (active) setLoad({ kind: 'failed' })
      })
    return () => {
      active = false
    }
  }, [eventId, attempt])

  useEffect(() => subscribeAssets(eventId, setAssets), [eventId])

  const dirty =
    load.kind === 'ready' && draft !== null && JSON.stringify(toPayload(draft)) !== JSON.stringify(toPayload(load.baseline))

  // Varna innan sidan stängs eller laddas om med osparade ändringar.
  useEffect(() => {
    if (!dirty) return
    const warn = (event: BeforeUnloadEvent) => event.preventDefault()
    window.addEventListener('beforeunload', warn)
    return () => window.removeEventListener('beforeunload', warn)
  }, [dirty])

  if (load.kind !== 'ready' || !draft) {
    return (
      <main className="page page--admin admin-center">
        <Card className="admin-login">
          <h1>Förbered kvällen</h1>
          {load.kind === 'failed' ? (
            <>
              <p role="alert" className="form-error">
                Kunde inte hämta kvällen ”{eventId}”. Kontrollera nätet och att kontot är admin.
              </p>
              <div className="admin-row">
                <Button variant="secondary" size="small" onClick={() => setAttempt((n) => n + 1)}>
                  Försök igen
                </Button>
                <Link to="/admin" className="link-button">
                  Till kontrollpanelen
                </Link>
              </div>
            </>
          ) : (
            <p className="muted">Hämtar kvällen…</p>
          )}
        </Card>
      </main>
    )
  }

  const { saved, phase } = load

  function edit(change: (d: Draft) => Draft) {
    setDraft((d) => (d ? change(d) : d))
    setStatus({ kind: 'idle' })
  }

  async function save() {
    if (!draft || load.kind !== 'ready') return
    const found = problems(draft)
    if (found.length > 0) {
      setStatus({ kind: 'error', messages: found })
      return
    }
    setStatus({ kind: 'saving' })
    try {
      const payload = toPayload(draft)
      await savePreparation(eventId, payload)
      for (const imageId of unusedImages(saved, draft)) removeAsset(eventId, imageId).catch(() => {})
      const nextSaved: Saved = {
        config: {
          ...(saved.config ?? { joinOpen: false }),
          name: payload['config/name'],
          gloggs: payload['config/gloggs'],
          criteria: payload['config/criteria'],
          songs: payload['config/songs'],
          questions: payload['config/questions'],
        },
        joinCode: payload['secret/joinCode'],
        numbers: payload['secret/numbers'],
        correct: payload['secret/correct'],
      }
      setLoad({ kind: 'ready', saved: nextSaved, baseline: toDraft(nextSaved, eventId), phase })
      setStatus({ kind: 'saved' })
    } catch {
      setStatus({ kind: 'error', messages: ['Kunde inte spara. Kontrollera nätet och försök igen.'] })
    }
  }

  /** En ny bild sparas direkt på glögger som redan finns, så att den gamla bilden kan tas bort. */
  async function changeImage(cls: GuestClass, gId: string, imageId: string) {
    const update = (d: Draft): Draft => ({
      ...d,
      gloggs: { ...d.gloggs, [cls]: d.gloggs[cls].map((g) => (g.gId === gId ? { ...g, imageId } : g)) },
    })
    const stored = saved.config?.gloggs?.[gId]
    if (stored && load.kind === 'ready') {
      await setGloggImage(eventId, gId, imageId)
      const nextSaved: Saved = {
        ...saved,
        config: { ...saved.config!, gloggs: { ...saved.config!.gloggs, [gId]: { ...stored, imageId } } },
      }
      setLoad({ ...load, saved: nextSaved, baseline: update(load.baseline) })
    }
    setDraft((d) => (d ? update(d) : d))
  }

  /** Som changeImage, för ett bildsvar. Sparas direkt bara om frågan redan finns som bildfråga. */
  async function changeAnswerImage(qId: string, choice: Choice, imageId: string) {
    const update = (d: Draft): Draft => ({
      ...d,
      songs: d.songs.map((s) => ({
        ...s,
        questions: s.questions.map((q) => (q.qId === qId ? { ...q, images: { ...q.images, [choice]: imageId } } : q)),
      })),
    })
    const stored = saved.config?.questions?.[qId]
    if (stored?.answerType === 'image' && load.kind === 'ready') {
      await setAnswerImage(eventId, qId, choice, imageId)
      const nextSaved: Saved = {
        ...saved,
        config: {
          ...saved.config!,
          questions: { ...saved.config!.questions, [qId]: { ...stored, options: { ...stored.options, [choice]: imageId } } },
        },
      }
      setLoad({ ...load, saved: nextSaved, baseline: update(load.baseline) })
    }
    setDraft((d) => (d ? update(d) : d))
  }

  return (
    <main className="page page--admin prepare">
      <header className="prepare__header">
        <div className="prepare__title">
          <Link to="/admin" className="prepare__back" aria-label="Tillbaka till kontrollpanelen">
            <svg aria-hidden="true" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M15 6l-6 6 6 6" />
            </svg>
          </Link>
          <h1>Förbered kvällen</h1>
        </div>
        <div className="prepare__save">
          <span className="prepare__status" role="status">
            {status.kind === 'saving' ? 'Sparar…' : status.kind === 'saved' ? 'Sparat' : dirty ? 'Osparade ändringar' : ''}
          </span>
          <Button size="small" onClick={save} disabled={!dirty || status.kind === 'saving'}>
            Spara
          </Button>
        </div>
      </header>

      {status.kind === 'error' && (
        <div role="alert" className="form-error prepare__errors">
          {status.messages.map((message) => (
            <p key={message}>{message}</p>
          ))}
        </div>
      )}

      <div className="prepare__grid">
        <div className="prepare__column">
          <EventCard draft={draft} onEdit={edit} />
          <GloggCard
            eventId={eventId}
            draft={draft}
            assets={assets}
            tastingStarted={phase !== null && phase !== 'registration'}
            onEdit={edit}
            onImage={changeImage}
            newId={() => newConfigId(eventId, 'gloggs')}
          />
          <CriteriaCard draft={draft} onEdit={edit} newId={() => newConfigId(eventId, 'criteria')} />
        </div>
        <div className="prepare__column">
          <QuizCard
            eventId={eventId}
            draft={draft}
            assets={assets}
            onEdit={edit}
            onAnswerImage={changeAnswerImage}
            newId={(kind) => newConfigId(eventId, kind)}
          />
          <SpotifySetup />
        </div>
      </div>
    </main>
  )
}

type EditProps = { draft: Draft; onEdit: (change: (d: Draft) => Draft) => void }

function EventCard({ draft, onEdit }: EditProps) {
  const nameId = useId()
  const codeId = useId()
  return (
    <Card className="prepare__card">
      <h2>Kvällen</h2>
      <div className="prepare__fields">
        <label className="prepare__field">
          <span id={nameId}>Namn</span>
          <input
            className="input"
            aria-labelledby={nameId}
            value={draft.name}
            onChange={(e) => onEdit((d) => ({ ...d, name: e.target.value }))}
          />
        </label>
        <label className="prepare__field">
          <span id={codeId}>Kod i QR-länken</span>
          <input
            className="input"
            aria-labelledby={codeId}
            autoCapitalize="off"
            spellCheck={false}
            value={draft.joinCode}
            onChange={(e) => onEdit((d) => ({ ...d, joinCode: e.target.value }))}
          />
        </label>
      </div>
      <p className="prepare__hint">Gäster som redan har gått med påverkas inte om koden byts, men gamla QR-koder slutar fungera.</p>
    </Card>
  )
}

type GloggCardProps = EditProps & {
  eventId: string
  assets: Record<string, string>
  tastingStarted: boolean
  onImage: (cls: GuestClass, gId: string, imageId: string) => Promise<void>
  newId: () => string
}

function GloggCard({ eventId, draft, assets, tastingStarted, onEdit, onImage, newId }: GloggCardProps) {
  const [cls, setCls] = useState<GuestClass>('vanlig')
  const list = draft.gloggs[cls]

  function setList(change: (list: DraftGlogg[]) => DraftGlogg[]) {
    onEdit((d) => ({ ...d, gloggs: { ...d.gloggs, [cls]: change(d.gloggs[cls]) } }))
  }

  function setGlogg(gId: string, patch: Partial<DraftGlogg>) {
    setList((l) => l.map((g) => (g.gId === gId ? { ...g, ...patch } : g)))
  }

  return (
    <Card className="prepare__card">
      <div className="prepare__card-head">
        <h2>Glögger</h2>
        <span className="prepare__hint">Nummer = serveringsordning</span>
      </div>
      <div className="prepare__toolbar">
        <Tabs
          label="Klass"
          value={cls}
          onChange={setCls}
          options={CLASSES.map((c) => ({ value: c, label: `${CLASS_LABEL[c]} · ${draft.gloggs[c].length}` }))}
        />
        <Button
          variant="secondary"
          size="small"
          onClick={() => setList((l) => [...l, { gId: newId(), name: '', description: '' }])}
        >
          + Lägg till
        </Button>
      </div>
      {tastingStarted && (
        <p className="prepare__warning" role="note">
          Provningen har börjat. Betygen sparas per nummer, så byter du ordning hamnar de på andra glögger.
        </p>
      )}
      {list.length === 0 ? (
        <p className="muted">Inga glögger i {CLASS_LABEL[cls].toLowerCase()} än.</p>
      ) : (
        <ol className="prepare__list">
          {list.map((g, i) => {
            const label = `glögg ${i + 1}`
            return (
              <li key={g.gId} className="glogg-row">
                <span className="glogg-row__number" aria-hidden="true">
                  {i + 1}
                </span>
                <ImageField
                  eventId={eventId}
                  imageId={g.imageId}
                  src={g.imageId ? assets[g.imageId] : undefined}
                  label={label}
                  onChange={(imageId) => onImage(cls, g.gId, imageId)}
                />
                <input
                  className="input"
                  aria-label={`Namn på ${label}`}
                  placeholder="Namn"
                  value={g.name}
                  onChange={(e) => setGlogg(g.gId, { name: e.target.value })}
                />
                <input
                  className="input glogg-row__description"
                  aria-label={`Beskrivning av ${label}`}
                  placeholder="Beskrivning"
                  value={g.description}
                  onChange={(e) => setGlogg(g.gId, { description: e.target.value })}
                />
                <RowActions
                  label={label}
                  index={i}
                  count={list.length}
                  onMove={(step) => setList((l) => move(l, i, step))}
                  onRemove={() => setList((l) => l.filter((x) => x.gId !== g.gId))}
                />
              </li>
            )
          })}
        </ol>
      )}
    </Card>
  )
}

function CriteriaCard({ draft, onEdit, newId }: EditProps & { newId: () => string }) {
  function setList(change: (list: DraftCriterion[]) => DraftCriterion[]) {
    onEdit((d) => ({ ...d, criteria: change(d.criteria) }))
  }
  function setCriterion(cId: string, patch: Partial<DraftCriterion>) {
    setList((l) => l.map((c) => (c.cId === cId ? { ...c, ...patch } : c)))
  }

  return (
    <Card className="prepare__card">
      <div className="prepare__card-head">
        <h2>Ranka på (1–5)</h2>
        <Button variant="secondary" size="small" onClick={() => setList((l) => [...l, { cId: newId(), name: '', lowIsGood: false }])}>
          + Lägg till
        </Button>
      </div>
      {draft.criteria.length === 0 ? (
        <p className="muted">Inga kriterier än, t.ex. Julkänsla, Mysfaktor eller Sliskighet.</p>
      ) : (
        <ol className="prepare__list">
          {draft.criteria.map((c, i) => {
            const label = c.name.trim() || `kriterium ${i + 1}`
            return (
              <li key={c.cId} className="criterion-row">
                <input
                  className="input"
                  aria-label={`Namn på kriterium ${i + 1}`}
                  placeholder="T.ex. Julkänsla"
                  value={c.name}
                  onChange={(e) => setCriterion(c.cId, { name: e.target.value })}
                />
                <label className="criterion-row__low">
                  <input
                    type="checkbox"
                    checked={c.lowIsGood}
                    onChange={(e) => setCriterion(c.cId, { lowIsGood: e.target.checked })}
                  />
                  lågt = bra
                </label>
                <RowActions
                  label={label}
                  index={i}
                  count={draft.criteria.length}
                  onMove={(step) => setList((l) => move(l, i, step))}
                  onRemove={() => setList((l) => l.filter((x) => x.cId !== c.cId))}
                />
              </li>
            )
          })}
        </ol>
      )}
    </Card>
  )
}
