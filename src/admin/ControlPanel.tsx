import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  changeGuestClass,
  removeGuest,
  setJoinOpen,
  setNowText,
  setPhase,
  subscribeConfig,
  subscribeGuests,
  subscribeLive,
} from '../data'
import type { EventConfig, Guest, GuestClass, LiveState, Phase } from '../types'
import { Button, Card, Chip } from '../ui'
import { SignOutButton } from './AdminGate'
import { GuestList } from './GuestList'
import { NowTextEditor } from './NowTextEditor'
import { PHASES, phaseIndex } from './phases'
import { PhaseList } from './PhaseList'
import { QrDialog } from './QrDialog'

type Props = {
  eventId: string
  eventName: string
  joinCode: string
  onChangeEvent: () => void
}

/** Admin – styr kvällen: flöde, Just nu-text, registrering, gäster och QR-kod. */
export function ControlPanel({ eventId, eventName, joinCode, onChangeEvent }: Props) {
  const [live, setLive] = useState<LiveState | null>(null)
  const [config, setConfig] = useState<EventConfig | null>(null)
  const [guests, setGuests] = useState<Record<string, Guest> | null>(null)
  const [lostConnection, setLostConnection] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [showQr, setShowQr] = useState(false)
  const closeQr = useCallback(() => setShowQr(false), [])

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
  const current = phaseIndex(live?.phase)
  const currentInfo = PHASES[current]
  const nextInfo = PHASES[current + 1]

  function goTo(phase: Phase) {
    void save(() => setPhase(eventId, phase))
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

  return (
    <main className="page page--admin control">
      <header className="control__header">
        <div className="admin-row">
          <span className="admin-brand">Glöggmingel</span>
          <span className="admin-badge">Admin</span>
          <span className="muted control__event">{config?.name ?? eventName}</span>
        </div>
        <div className="admin-row">
          <span className="control__count">
            {guestCount === null ? 'Hämtar gäster…' : `${guestCount} ${guestCount === 1 ? 'gäst' : 'gäster'} inne`}
          </span>
          <Button variant="secondary" size="small" onClick={() => setShowQr(true)}>
            Visa QR-kod
          </Button>
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

      <div className="control__body">
        <PhaseList current={live?.phase} disabled={busy || !live} onSelect={goTo} />

        <Card className="control__main">
          <span className="eyebrow eyebrow--gold">
            {currentInfo ? `Just nu · steg ${current + 1} av ${PHASES.length}` : 'Just nu'}
          </span>
          <h2 className="control__phase">{currentInfo?.label ?? (live ? 'Ingen fas vald' : 'Hämtar…')}</h2>
          {currentInfo && <p className="muted">{currentInfo.sub}</p>}

          <NowTextEditor value={live?.nowText ?? ''} disabled={busy || !live} onSave={(text) => save(() => setNowText(eventId, text))} />

          {config && (
            <Card compact className="control__join">
              <div className="control__join-text">
                <strong>Registreringen är {joinOpen ? 'öppen' : 'stängd'}</strong>
                <span className="muted">
                  {joinOpen ? 'Nya gäster kan gå med via QR-koden.' : 'Inga nya gäster kan gå med.'}
                </span>
              </div>
              <Chip tone={joinOpen ? 'green' : 'rose'}>{joinOpen ? 'Öppen' : 'Stängd'}</Chip>
              <Button
                variant="secondary"
                size="small"
                disabled={busy}
                onClick={() => void save(() => setJoinOpen(eventId, !joinOpen))}
              >
                {joinOpen ? 'Stäng registreringen' : 'Öppna registreringen'}
              </Button>
            </Card>
          )}

          <div className="control__spacer" />

          {nextInfo && (
            <Button size="large" block disabled={busy || !live} onClick={() => goTo(nextInfo.phase)}>
              Nästa: {nextInfo.label}
            </Button>
          )}
        </Card>

        <GuestList guests={guests} disabled={busy} onChangeClass={onChangeClass} onRemove={onRemove} />
      </div>

      <footer className="control__footer">
        <button type="button" className="link-button" onClick={onChangeEvent}>
          Byt kväll
        </button>
        <Link to="/admin/spotify">Testa Spotify</Link>
      </footer>

      {showQr && (
        <QrDialog eventId={eventId} joinCode={joinCode} joinOpen={joinOpen} onClose={closeQr} />
      )}
    </main>
  )
}
