import { useEffect, useId, useState, type FormEvent } from 'react'
import { useLocation } from 'react-router-dom'
import { openAdminEvent, type AdminEventResult } from '../data'
import { Button, Card } from '../ui'
import { SignOutButton } from './AdminGate'
import { readAdminEventId, rememberAdminEventId } from './adminEvent'
import { ControlPanel } from './ControlPanel'

type FailReason = Extract<AdminEventResult, { ok: false }>['reason']

type State =
  | { kind: 'choose' }
  | { kind: 'loading'; eventId: string }
  | { kind: 'failed'; eventId: string; reason: FailReason }
  | { kind: 'ready'; eventId: string; name: string; joinCode: string }

const ERRORS: Record<FailReason, (eventId: string) => string> = {
  'not-admin': () => 'Kontot har inte admin-behörighet. Lägg till dess uid under /admins i Firebase.',
  'no-event': (eventId) => `Det finns ingen kväll med id ”${eventId}”.`,
  error: () => 'Kunde inte hämta kvällen. Kontrollera nätet och försök igen.',
}

/** Styr kvällen. Ligger bakom AdminGate, så admin är inloggad här. */
export default function AdminPanel() {
  const { search } = useLocation()
  const [state, setState] = useState<State>(() => {
    const eventId = readAdminEventId(search)
    return eventId ? { kind: 'loading', eventId } : { kind: 'choose' }
  })
  const loadingId = state.kind === 'loading' ? state.eventId : null

  useEffect(() => {
    if (!loadingId) return
    let active = true
    openAdminEvent(loadingId).then((result) => {
      if (!active) return
      setState(
        result.ok
          ? { kind: 'ready', eventId: loadingId, name: result.name, joinCode: result.joinCode }
          : { kind: 'failed', eventId: loadingId, reason: result.reason },
      )
    })
    return () => {
      active = false
    }
  }, [loadingId])

  function chooseEvent(eventId: string | null) {
    rememberAdminEventId(eventId)
    setState(eventId ? { kind: 'loading', eventId } : { kind: 'choose' })
  }

  if (state.kind === 'ready') {
    return (
      <ControlPanel
        eventId={state.eventId}
        eventName={state.name}
        joinCode={state.joinCode}
        onChangeEvent={() => chooseEvent(null)}
      />
    )
  }

  return (
    <main className="page page--admin admin-center">
      <Card className="admin-login">
        <h1>Styr kvällen</h1>
        {state.kind === 'loading' && <p className="muted">Hämtar kvällen…</p>}
        {state.kind === 'failed' && (
          <>
            <p role="alert" className="form-error">
              {ERRORS[state.reason](state.eventId)}
            </p>
            <div className="admin-row">
              <Button variant="secondary" size="small" onClick={() => chooseEvent(state.eventId)}>
                Försök igen
              </Button>
              <Button variant="secondary" size="small" onClick={() => chooseEvent(null)}>
                Välj en annan kväll
              </Button>
              <SignOutButton />
            </div>
          </>
        )}
        {state.kind === 'choose' && <ChooseEvent onChoose={chooseEvent} />}
      </Card>
    </main>
  )
}

function ChooseEvent({ onChoose }: { onChoose: (eventId: string) => void }) {
  const inputId = useId()
  const [value, setValue] = useState('')

  function onSubmit(event: FormEvent) {
    event.preventDefault()
    const eventId = value.trim()
    if (eventId) onChoose(eventId)
  }

  return (
    <form className="admin-form" onSubmit={onSubmit}>
      <label htmlFor={inputId}>Vilken kväll vill du styra?</label>
      <input
        id={inputId}
        className="input"
        type="text"
        placeholder="Kvällens id, t.ex. demo"
        autoCapitalize="off"
        spellCheck={false}
        value={value}
        onChange={(e) => setValue(e.target.value)}
      />
      <div className="admin-row">
        <Button type="submit" size="small" disabled={!value.trim()}>
          Öppna
        </Button>
        <SignOutButton />
      </div>
    </form>
  )
}
