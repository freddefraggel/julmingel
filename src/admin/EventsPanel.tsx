import { useEffect, useId, useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { createEvent, eventExists, subscribeEventIndex } from '../data'
import { Button, Card } from '../ui'
import { SignOutButton } from './AdminGate'
import { newEventProblems, sortedEvents, suggestId, type EventIndexEntry } from './events'
import './events.css'

type Props = {
  /** Öppnar kvällen i kontrollpanelen. */
  onChoose: (eventId: string) => void
}

/**
 * Kvällar: välj, skapa och redigera (#75). Listan kommer från registret
 * `/eventIndex`, så att inga kvällars bilder laddas ned här.
 */
export function EventsPanel({ onChoose }: Props) {
  const [index, setIndex] = useState<Record<string, EventIndexEntry> | null>(null)
  const [failed, setFailed] = useState(false)

  useEffect(() => subscribeEventIndex(setIndex, () => setFailed(true)), [])

  const events = sortedEvents(index)

  return (
    <main className="page page--admin events">
      <header className="events__header">
        <div className="admin-row">
          <span className="admin-brand">Glöggmingel</span>
          <span className="admin-badge">Admin</span>
        </div>
        <SignOutButton />
      </header>
      <h1>Kvällar</h1>

      {failed && (
        <p role="alert" className="form-error">
          Kunde inte hämta kvällarna. Kontrollera nätet, och att kontot är admin.
        </p>
      )}

      <div className="events__body">
        <Card className="events__list-card">
          <h2>Välj kväll</h2>
          {index === null && !failed ? (
            <p className="muted">Hämtar kvällarna…</p>
          ) : events.length === 0 ? (
            <p className="muted">Inga kvällar än. Skapa en till höger, eller öppna en befintlig med dess id.</p>
          ) : (
            <ul className="events__list">
              {events.map((e) => (
                <li key={e.eventId} className="events__row">
                  <span className="events__name">
                    <strong>{e.name || e.eventId}</strong>
                    <span className="muted">{e.eventId}</span>
                  </span>
                  <span className="admin-row">
                    <Button size="small" onClick={() => onChoose(e.eventId)}>
                      Styr kvällen
                    </Button>
                    <Link to={`/admin/forbered?e=${encodeURIComponent(e.eventId)}`} className="btn btn--secondary btn--small">
                      Förbered
                    </Link>
                  </span>
                </li>
              ))}
            </ul>
          )}
          <OpenById onChoose={onChoose} />
        </Card>

        <NewEventCard events={events} onCreated={onChoose} />
      </div>
    </main>
  )
}

/** För kvällar som inte finns i registret än; de läggs in när de öppnas. */
function OpenById({ onChoose }: { onChoose: (eventId: string) => void }) {
  const inputId = useId()
  const [value, setValue] = useState('')

  function onSubmit(event: FormEvent) {
    event.preventDefault()
    const eventId = value.trim()
    if (eventId) onChoose(eventId)
  }

  return (
    <form className="admin-form events__open" onSubmit={onSubmit}>
      <label htmlFor={inputId}>Öppna kväll med id</label>
      <div className="admin-row">
        <input
          id={inputId}
          className="input"
          type="text"
          placeholder="t.ex. glogg2026"
          autoCapitalize="off"
          spellCheck={false}
          value={value}
          onChange={(e) => setValue(e.target.value)}
        />
        <Button type="submit" variant="secondary" size="small" disabled={!value.trim()}>
          Öppna
        </Button>
      </div>
    </form>
  )
}

type NewEventProps = {
  events: ReturnType<typeof sortedEvents>
  onCreated: (eventId: string) => void
}

function NewEventCard({ events, onCreated }: NewEventProps) {
  const ids = { name: useId(), id: useId(), code: useId(), copy: useId() }
  const [name, setName] = useState('')
  const [eventId, setEventId] = useState('')
  const [idTouched, setIdTouched] = useState(false)
  const [joinCode, setJoinCode] = useState('')
  const [copyFrom, setCopyFrom] = useState('')
  const [problems, setProblems] = useState<string[]>([])
  const [busy, setBusy] = useState(false)

  function changeName(value: string) {
    setName(value)
    // Föreslå ett id från namnet tills admin skriver ett eget.
    if (!idTouched) setEventId(suggestId(value))
  }

  async function onSubmit(event: FormEvent) {
    event.preventDefault()
    const input = { eventId: eventId.trim(), name, joinCode }
    let found = newEventProblems(input, false)
    if (found.length > 0) {
      setProblems(found)
      return
    }
    setBusy(true)
    setProblems([])
    try {
      found = newEventProblems(input, await eventExists(input.eventId))
      if (found.length > 0) {
        setProblems(found)
        setBusy(false)
        return
      }
      await createEvent(input, copyFrom || null)
      onCreated(input.eventId)
    } catch {
      setProblems(['Kunde inte skapa kvällen. Kontrollera nätet och försök igen.'])
      setBusy(false)
    }
  }

  return (
    <Card className="events__new">
      <h2>Ny kväll</h2>
      <form className="admin-form" onSubmit={(e) => void onSubmit(e)}>
        <label htmlFor={ids.name}>Namn</label>
        <input id={ids.name} className="input" value={name} placeholder="Gröna Villans Glöggmingel 2027" onChange={(e) => changeName(e.target.value)} />

        <label htmlFor={ids.id}>Id i adressen</label>
        <input
          id={ids.id}
          className="input"
          value={eventId}
          autoCapitalize="off"
          spellCheck={false}
          placeholder="glogg2027"
          onChange={(e) => {
            setIdTouched(true)
            setEventId(e.target.value)
          }}
        />

        <label htmlFor={ids.code}>Kod i QR-länken</label>
        <input id={ids.code} className="input" value={joinCode} autoCapitalize="off" spellCheck={false} onChange={(e) => setJoinCode(e.target.value)} />

        <label htmlFor={ids.copy}>Kopiera från</label>
        <select id={ids.copy} className="input" value={copyFrom} onChange={(e) => setCopyFrom(e.target.value)}>
          <option value="">Ingen – börja tomt</option>
          {events.map((e) => (
            <option key={e.eventId} value={e.eventId}>
              {e.name || e.eventId}
            </option>
          ))}
        </select>
        <p className="prepare__hint">
          {copyFrom
            ? 'Glögger, kriterier, låtar, frågor, bilder, glöggordning och facit kopieras. Gäster, betyg, svar och resultat följer inte med.'
            : 'Kvällen börjar tom. Lägg in glögger och quiz under Förbered kvällen.'}
        </p>

        {problems.length > 0 && (
          <div role="alert" className="form-error">
            {problems.map((p) => (
              <p key={p}>{p}</p>
            ))}
          </div>
        )}

        <Button type="submit" disabled={busy}>
          {busy ? 'Skapar…' : 'Skapa kvällen'}
        </Button>
      </form>
    </Card>
  )
}
