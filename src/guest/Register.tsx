import { useEffect, useId, useState, type FormEvent } from 'react'
import { getEventName, joinEvent, signInGuest, type JoinResult } from '../data'
import type { Guest, GuestClass } from '../types'
import { Button, Garland, Snow } from '../ui'

const MAX_NAME = 30

const CLASSES: { value: GuestClass; label: string }[] = [
  { value: 'vanlig', label: 'Vanlig' },
  { value: 'alkfri', label: 'Alkoholfri' },
]

type FailReason = Extract<JoinResult, { ok: false }>['reason']

const ERRORS: Record<FailReason, string> = {
  closed: 'Registreringen är stängd. Prata med värden om du vill vara med.',
  'wrong-code': 'Koden i länken stämmer inte. Skanna QR-koden hos värden igen.',
  'no-event': 'Vi hittar inte kvällen. Skanna QR-koden hos värden igen.',
  error: 'Något gick fel. Kontrollera nätet och försök igen.',
}

type Props = {
  eventId: string
  joinCode: string
  onJoined: (guest: Guest, uid: string) => void
}

/** 1. Registrera: namn, Vanlig/Alkoholfri, Gå med. */
export function Register({ eventId, joinCode, onJoined }: Props) {
  const nameId = useId()
  const errorId = useId()
  const [name, setName] = useState('')
  const [guestClass, setGuestClass] = useState<GuestClass>('vanlig')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [eventName, setEventName] = useState<string | null>(null)

  // Vilken kväll gästen går med i. Kvällens namn är inte hemligt.
  useEffect(() => {
    let active = true
    getEventName(eventId).then((name) => {
      if (active) setEventName(name)
    })
    return () => {
      active = false
    }
  }, [eventId])

  async function onSubmit(event: FormEvent) {
    event.preventDefault()
    const trimmed = name.trim()
    if (!trimmed) {
      setError('Skriv ditt namn så att vi vet vem du är.')
      return
    }
    if (trimmed.length > MAX_NAME) {
      setError(`Namnet får vara högst ${MAX_NAME} tecken.`)
      return
    }

    setBusy(true)
    setError(null)
    try {
      const user = await signInGuest()
      const result = await joinEvent(eventId, user.uid, { name: trimmed, class: guestClass, joinCode })
      if (result.ok) {
        onJoined(result.guest, user.uid)
        return
      }
      setError(ERRORS[result.reason])
    } catch {
      setError(ERRORS.error)
    }
    setBusy(false)
  }

  return (
    <main className="page guest-page register">
      <Garland />
      <Snow />
      <span className="brand">{eventName ?? 'Glöggmingel'}</span>

      <div className="register__body">
        <div className="register__title">
          <h1>Välkommen in i värmen</h1>
          <div className="candy" aria-hidden="true" />
        </div>

        <form className="register__form" onSubmit={onSubmit} noValidate>
          <label htmlFor={nameId} className="visually-hidden">
            Ditt namn
          </label>
          <input
            id={nameId}
            className="input input--large"
            type="text"
            placeholder="Ditt namn"
            autoComplete="given-name"
            maxLength={MAX_NAME}
            value={name}
            onChange={(e) => setName(e.target.value)}
            aria-invalid={error ? true : undefined}
            aria-describedby={error ? errorId : undefined}
            disabled={busy}
          />

          <fieldset className="register__classes" disabled={busy}>
            <legend>Vilken glöggprovning är du med i?</legend>
            <div className="class-options">
              {CLASSES.map((option) => (
                <label key={option.value} className="class-option">
                  <input
                    type="radio"
                    name="klass"
                    value={option.value}
                    checked={guestClass === option.value}
                    onChange={() => setGuestClass(option.value)}
                  />
                  <span>{option.label}</span>
                </label>
              ))}
            </div>
          </fieldset>

          {error && (
            <p id={errorId} role="alert" className="form-error">
              {error}
            </p>
          )}

          <Button type="submit" block disabled={busy}>
            {busy ? 'Går med…' : 'Gå med'}
          </Button>
        </form>
      </div>
    </main>
  )
}
