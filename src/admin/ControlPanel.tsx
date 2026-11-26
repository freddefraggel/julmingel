import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  changeGuestClass,
  removeGuest,
  setJoinOpen,
  setStage,
  setWrapupStep,
  subscribeConfig,
  subscribeGuests,
  subscribeLive,
} from '../data'
import { stageIndex, STAGES, WRAPUP_STEPS } from '../live'
import type { EventConfig, Guest, GuestClass, LiveState, Stage } from '../types'
import { Button, Card, Chip } from '../ui'
import { SignOutButton } from './AdminGate'
import { GuessPanel } from './GuessPanel'
import { GuestList } from './GuestList'
import { QuizPanel } from './QuizPanel'
import { RevealPanel } from './RevealPanel'
import { SpotifySetup } from './SpotifySetup'
import { ReviewPanel } from './ReviewPanel'
import { TastingPanel } from './TastingPanel'

type Props = {
  eventId: string
  eventName: string
  onChangeEvent: () => void
}

/**
 * Admin – styr kvällen (docs/design/AdminKontroll.dc.html): kvällens tre lägen
 * överst, och under kvällen Glöggprovning och Musikquiz sida vid sida.
 */
export function ControlPanel({ eventId, eventName, onChangeEvent }: Props) {
  // undefined medan live/ hämtas; null när kvällen inte har någon live/ än (en ny kväll).
  const [live, setLive] = useState<LiveState | null | undefined>(undefined)
  const [config, setConfig] = useState<EventConfig | null>(null)
  const [guests, setGuests] = useState<Record<string, Guest> | null>(null)
  const [lostConnection, setLostConnection] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    const onError = () => setLostConnection(true)
    const unsubscribers = [
      subscribeLive(eventId, setLive, onError),
      subscribeConfig(eventId, setConfig, onError),
      subscribeGuests(eventId, setGuests, onError),
    ]
    return () => unsubscribers.forEach((unsubscribe) => unsubscribe())
  }, [eventId])

  /** Kör en skrivning och visar ett fel om den inte går igenom. Ger true om den lyckades. */
  async function save(write: () => Promise<void>): Promise<boolean> {
    setBusy(true)
    setSaveError(null)
    try {
      await write()
      return true
    } catch {
      setSaveError('Kunde inte spara. Kontrollera nätet och försök igen.')
      return false
    } finally {
      setBusy(false)
    }
  }

  const guestCount = guests ? Object.keys(guests).length : null
  const joinOpen = config?.joinOpen === true
  const loaded = live !== undefined
  const stage = live?.stage
  const at = stageIndex(stage)

  function changeStage(next: Stage) {
    void save(() => setStage(eventId, next, live))
  }

  function onChangeClass(uid: string, guest: Guest, guestClass: GuestClass) {
    const label = guestClass === 'vanlig' ? 'Vanlig' : 'Alkoholfri'
    if (!window.confirm(`Flytta ${guest.name} till ${label}? Betyg som ${guest.name} redan har satt tas bort.`)) return
    void save(() => changeGuestClass(eventId, uid, guestClass))
  }

  function onRemove(uid: string, guest: Guest) {
    if (!window.confirm(`Ta bort ${guest.name}? Betyg, svar och gissningar tas också bort.`)) return
    void save(() => removeGuest(eventId, uid))
  }

  const joinCard = config && (
    <Card compact className="control__join">
      <div className="control__join-text">
        <strong>Registreringen är {joinOpen ? 'öppen' : 'stängd'}</strong>
        <span className="muted">
          {joinOpen
            ? 'Nya gäster kan gå med via QR-koden. Håll den öppen tills alla har kommit – en utskriven kod slutar fungera när registreringen stängs.'
            : 'Inga nya gäster kan gå med, inte heller med en utskriven QR-kod.'}
        </span>
      </div>
      <Chip tone={joinOpen ? 'green' : 'rose'}>{joinOpen ? 'Öppen' : 'Stängd'}</Chip>
      <Button variant="secondary" size="small" disabled={busy} onClick={() => void save(() => setJoinOpen(eventId, !joinOpen))}>
        {joinOpen ? 'Stäng registreringen' : 'Öppna registreringen'}
      </Button>
    </Card>
  )
  const guestList = <GuestList guests={guests} disabled={busy} onChangeClass={onChangeClass} onRemove={onRemove} />

  return (
    <main className="page page--admin control">
      <header className="control__header">
        <div className="admin-row">
          <span className="admin-brand">Glöggmingel</span>
          <span className="admin-badge">Admin</span>
          <span className="muted control__event">{config?.name ?? eventName}</span>
        </div>
        <div role="group" aria-label="Kvällens läge" className="stages">
          {STAGES.map((s, i) => {
            const current = i === at
            return (
              <button
                key={s.stage}
                type="button"
                className={`stages__stage${current ? ' stages__stage--current' : ''}`}
                aria-pressed={current}
                disabled={busy || !loaded}
                onClick={() => changeStage(s.stage)}
              >
                {s.label}
                {i < at && ' ✓'}
              </button>
            )
          })}
        </div>
        <div className="admin-row">
          <span className="control__count">
            {guestCount === null ? 'Hämtar gäster…' : `${guestCount} ${guestCount === 1 ? 'gäst' : 'gäster'}`}
          </span>
          <Link to="/admin/qr" className="btn btn--secondary btn--small">
            Visa QR
          </Link>
          <Link to="/admin/forbered" className="btn btn--secondary btn--small">
            Förbered kvällen
          </Link>
          <SignOutButton />
        </div>
      </header>

      {lostConnection && (
        <p role="alert" className="form-error">
          Tappade kontakten med databasen. Ladda om sidan.
        </p>
      )}
      {saveError && (
        <p role="alert" className="form-error">
          {saveError}
        </p>
      )}

      <h1 className="visually-hidden">Styr kvällen</h1>

      {!loaded ? (
        <p className="muted">Hämtar kvällen…</p>
      ) : stage === 'evening' && live ? (
        <>
          <div className="control__columns">
            <section className="card control__column" aria-label="Glöggprovning">
              <TastingPanel eventId={eventId} config={config} live={live} guests={guests} disabled={busy} save={save} />
            </section>
            <section className="card control__column" aria-label="Musikquiz">
              <h2 className="control__column-title">Musikquiz</h2>
              <QuizPanel eventId={eventId} config={config} live={live} guests={guests} disabled={busy} save={save} />
              <SpotifySetup compact returnHash="#/admin" />
            </section>
          </div>
          {joinCard}
          <details className="control__guests">
            <summary>Gäster{guestCount !== null ? ` · ${guestCount}` : ''}</summary>
            {guestList}
          </details>
        </>
      ) : (stage === 'wrapup' || stage === 'done') && live ? (
        <Card className="control__wrapup">
          <div role="tablist" aria-label="Rättning och avslöjande" className="tabs">
            {WRAPUP_STEPS.map((s) => {
              const selected = stage === 'done' ? s.step === 'done' : (live.wrapup?.step ?? 'review') === s.step
              return (
                <button
                  key={s.step}
                  type="button"
                  role="tab"
                  aria-selected={selected}
                  className="tabs__tab"
                  disabled={busy}
                  onClick={() => void save(() => setWrapupStep(eventId, s.step))}
                >
                  {s.label}
                </button>
              )
            })}
          </div>
          {stage === 'done' ? (
            <p className="quiz-panel__done">Kvällen är klar. Gästerna ser sin pokal och topplistan.</p>
          ) : live.wrapup?.step === 'guess' ? (
            <GuessPanel eventId={eventId} config={config} guests={guests} disabled={busy} save={save} />
          ) : live.wrapup?.step === 'reveal' ? (
            <RevealPanel eventId={eventId} config={config} live={live} guests={guests} disabled={busy} save={save} />
          ) : (
            <ReviewPanel eventId={eventId} config={config} live={live} guests={guests} disabled={busy} save={save} />
          )}
        </Card>
      ) : (
        <div className="control__lobby">
          <Card className="control__intro">
            <span className="eyebrow eyebrow--gold">{stage === 'lobby' ? 'Innan start' : 'Kvällen har inte börjat'}</span>
            <h2 className="control__phase">Välkommen in</h2>
            <p className="muted">
              Gästerna går med via QR-koden och ser en startsida. Tryck på <strong>Kvällen pågår</strong> när ni börjar
              – då kan du servera glögg och spela quizet, i vilken ordning du vill.
            </p>
            {joinCard}
            <Button size="large" block disabled={busy} onClick={() => changeStage('evening')}>
              Starta kvällen
            </Button>
          </Card>
          {guestList}
        </div>
      )}

      <footer className="control__footer">
        <button type="button" className="link-button" onClick={onChangeEvent}>
          Alla kvällar
        </button>
        <Link to="/admin/spotify">Testa Spotify</Link>
      </footer>

    </main>
  )
}
