import { useEffect, useId, useRef, useState } from 'react'
import { saveNote, saveRatings } from '../data'
import { NOTE_MAX_LENGTH, type Criterion, type GuestNotes, type GuestRatings, type Rating } from '../types'
import { Garland } from '../ui'
import { BackButton } from './BackButton'

type Props = {
  eventId: string
  uid: string
  /** Antal glögger i gästens klass. Numren är 1…count. */
  count: number
  criteria: Record<string, Criterion> | undefined
  /** Gästens sparade betyg. */
  ratings: GuestRatings
  /** Gästens sparade anteckningar. */
  notes?: GuestNotes
  /** Numret som serveras nu (`live/tasting/{class}/serving`), eller null. */
  serving: number | null
  /** Rankningen är öppen i gästens klass. Stängd: betygen syns men går inte att ändra. */
  open?: boolean
  onBack: () => void
}

type Status = { kind: 'idle' } | { kind: 'saved'; number: number } | { kind: 'error'; message: string }

const VALUES: readonly Rating[] = [1, 2, 3, 4, 5]
/** Anteckningen sparas så här länge efter senaste tangenttryck. */
export const NOTE_SAVE_DELAY_MS = 600
/** Räknaren visas när anteckningen närmar sig gränsen. */
const NOTE_COUNTER_FROM = 400

/**
 * 3. Ranka glögg: välj nummer och 1–5 per kriterium. Varje tryck sparas direkt,
 * med en diskret bekräftelse. Följer numret som serveras, men gästen kan gå tillbaka.
 */
export function Rate({ eventId, uid, count, criteria, ratings, notes = {}, serving, open = true, onBack }: Props) {
  const [current, setCurrent] = useState<number>(() => clamp(serving ?? 1, count))
  // Tryck som är på väg till databasen, per nummer, så att knappen visar valet direkt.
  const [pending, setPending] = useState<Record<number, Record<string, Rating>>>({})
  const [status, setStatus] = useState<Status>({ kind: 'idle' })
  // Anteckningar som gästen skriver men som inte är sparade än, per nummer.
  const [drafts, setDrafts] = useState<Record<number, string>>({})
  const draftsRef = useRef(drafts)
  draftsRef.current = drafts
  const timers = useRef<Record<number, number>>({})
  const noteId = useId()

  // Värden serverar en ny glögg: hoppa dit.
  useEffect(() => {
    if (serving !== null) {
      setCurrent(clamp(serving, count))
      setStatus({ kind: 'idle' })
    }
  }, [serving, count])

  const sorted = Object.entries(criteria ?? {}).sort(([a, x], [b, y]) => x.order - y.order || (a < b ? -1 : 1))
  const saved = ratings[String(current)] ?? {}
  const values = { ...saved, ...pending[current] }
  const isRated = (n: number) => Object.keys(ratings[String(n)] ?? {}).length > 0
  const note = drafts[current] ?? notes[String(current)] ?? ''

  async function storeNote(number: number, text: string) {
    window.clearTimeout(timers.current[number])
    delete timers.current[number]
    try {
      await saveNote(eventId, uid, String(number), text)
      // Utkastet behövs inte längre, om gästen inte har skrivit mer under tiden.
      setDrafts((d) => {
        if (d[number] !== text) return d
        const rest = { ...d }
        delete rest[number]
        return rest
      })
      setStatus({ kind: 'saved', number })
    } catch {
      setStatus({ kind: 'error', message: 'Kunde inte spara anteckningen. Provningen kan vara stängd – fråga värden.' })
    }
  }

  function changeNote(text: string) {
    const number = current
    setDrafts((d) => ({ ...d, [number]: text }))
    window.clearTimeout(timers.current[number])
    timers.current[number] = window.setTimeout(() => void storeNote(number, text), NOTE_SAVE_DELAY_MS)
  }

  function flushNote() {
    const text = draftsRef.current[current]
    if (text !== undefined && timers.current[current] !== undefined) void storeNote(current, text)
  }

  // Lämnar gästen sidan med en anteckning som väntar: spara den direkt.
  useEffect(
    () => () => {
      for (const [number, timer] of Object.entries(timers.current)) {
        window.clearTimeout(timer)
        const text = draftsRef.current[Number(number)]
        if (text !== undefined) void saveNote(eventId, uid, number, text).catch(() => {})
      }
      timers.current = {}
    },
    [eventId, uid],
  )

  async function pick(cId: string, value: Rating) {
    const number = current
    setPending((p) => ({ ...p, [number]: { ...p[number], [cId]: value } }))
    try {
      await saveRatings(eventId, uid, String(number), { [cId]: value })
      setStatus({ kind: 'saved', number })
    } catch {
      // Ta bort trycket som inte kom fram, så att knapparna visar det som faktiskt är sparat.
      setPending((p) => {
        const rest = { ...p[number] }
        delete rest[cId]
        return { ...p, [number]: rest }
      })
      setStatus({ kind: 'error', message: 'Kunde inte spara. Provningen kan vara stängd – fråga värden.' })
    }
  }

  return (
    <main className="page guest-page rate">
      <Garland />
      <BackButton onClick={onBack} />

      <section className="rate__pick" aria-label="Välj glögg">
        <span className="eyebrow">Välj glögg</span>
        <div className="rate__numbers">
          {Array.from({ length: count }, (_, i) => i + 1).map((n) => {
            const classes = ['rate__number']
            if (n === current) classes.push('rate__number--current')
            else if (isRated(n)) classes.push('rate__number--rated')
            return (
              <button
                key={n}
                type="button"
                className={classes.join(' ')}
                aria-pressed={n === current}
                aria-label={`Glögg ${n}${isRated(n) ? ', rankad' : ''}${n === serving ? ', serveras nu' : ''}`}
                onClick={() => {
                  setCurrent(n)
                  setStatus({ kind: 'idle' })
                }}
              >
                {n}
              </button>
            )
          })}
        </div>
      </section>

      <h1>Glögg nr {current}</h1>

      {!open && (
        <p className="rate__closed" role="status">
          Provningen är stängd – tack för dina betyg!
        </p>
      )}

      {sorted.length === 0 ? (
        <p className="muted">Värden har inte lagt in några kriterier än.</p>
      ) : (
        <div className="rate__criteria">
          {sorted.map(([cId, criterion]) => (
            <fieldset key={cId} className={`rate-criterion${criterion.lowIsGood ? ' rate-criterion--low' : ''}`}>
              <legend className="rate-criterion__label">
                {criterion.name}
                {criterion.lowIsGood && <span className="rate-criterion__low">lågt = bra</span>}
              </legend>
              <div className="rate-criterion__values">
                {VALUES.map((v) => {
                  const on = (values[cId] ?? 0) >= v
                  return (
                    <button
                      key={v}
                      type="button"
                      className={`rate-criterion__value${on ? ' rate-criterion__value--on' : ''}`}
                      aria-pressed={values[cId] === v}
                      aria-label={`${criterion.name} ${v}`}
                      disabled={!open}
                      onClick={() => void pick(cId, v)}
                    >
                      {v}
                    </button>
                  )
                })}
              </div>
            </fieldset>
          ))}
        </div>
      )}

      {(open || note) && (
        <div className="rate-note">
          <label className="rate-note__label" htmlFor={noteId}>
            Egen anteckning
            <span className="rate-note__hint">bara du ser den</span>
          </label>
          <textarea
            id={noteId}
            className="input rate-note__input"
            value={note}
            placeholder="kanel, för söt …"
            maxLength={NOTE_MAX_LENGTH}
            rows={3}
            readOnly={!open}
            onChange={(e) => changeNote(e.target.value)}
            onBlur={flushNote}
          />
          {note.length >= NOTE_COUNTER_FROM && (
            <span className="rate-note__count" aria-live="polite">
              {note.length} / {NOTE_MAX_LENGTH}
            </span>
          )}
        </div>
      )}

      <div className="rate__spacer" />

      <div className="rate__save" aria-live="polite">
        {status.kind === 'saved' && status.number === current && (
          <p role="status" className="rate__ok">
            Sparat ✓
          </p>
        )}
        {status.kind === 'error' && (
          <p role="alert" className="form-error">
            {status.message}
          </p>
        )}
      </div>
    </main>
  )
}

function clamp(n: number, count: number): number {
  return Math.min(Math.max(1, n), Math.max(1, count))
}
