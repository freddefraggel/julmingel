import { createContext, useContext, useEffect, useId, useState, type FormEvent, type ReactNode } from 'react'
import { isWrongCredentials, onUserChanged, signInAdmin, signOut, type SignedInUser } from '../data'
import { Button, Card } from '../ui'
import './admin.css'

type AuthState = { kind: 'loading' } | { kind: 'signed-out' } | { kind: 'signed-in'; user: SignedInUser }

const AdminUserContext = createContext<SignedInUser | null>(null)

/** Inloggad admin. Får bara användas inuti AdminGate. */
export function useAdminUser(): SignedInUser {
  const user = useContext(AdminUserContext)
  if (!user) throw new Error('useAdminUser används utanför AdminGate')
  return user
}

type Props = {
  /** Rubriken på inloggningssidan, t.ex. ”Styr kvällen”. */
  title: string
  children: ReactNode
}

/**
 * Skyddar admin-sidorna: visar inloggning med e-post och lösenord tills en
 * admin är inloggad. En anonym gästinloggning i samma webbläsare räknas inte.
 * Om kontot verkligen är admin avgör databasreglerna (/admins/{uid}).
 */
export function AdminGate({ title, children }: Props) {
  const [auth, setAuth] = useState<AuthState>({ kind: 'loading' })

  useEffect(
    () =>
      onUserChanged((user) =>
        setAuth(user && !user.isAnonymous ? { kind: 'signed-in', user } : { kind: 'signed-out' }),
      ),
    [],
  )

  if (auth.kind === 'loading') {
    return (
      <main className="page page--admin admin-center" aria-busy="true">
        <p className="muted">Ett ögonblick…</p>
      </main>
    )
  }
  if (auth.kind === 'signed-out') return <AdminLogin title={title} />
  return <AdminUserContext.Provider value={auth.user}>{children}</AdminUserContext.Provider>
}

function AdminLogin({ title }: { title: string }) {
  const emailId = useId()
  const passwordId = useId()
  const errorId = useId()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  async function onSubmit(event: FormEvent) {
    event.preventDefault()
    if (!email.trim() || !password) {
      setError('Fyll i e-post och lösenord.')
      return
    }
    setBusy(true)
    setError(null)
    try {
      // Lyckas det byter AdminGate vy när onUserChanged hör av sig.
      await signInAdmin(email.trim(), password)
    } catch (err) {
      setError(
        isWrongCredentials(err)
          ? 'Fel e-post eller lösenord.'
          : 'Kunde inte logga in. Kontrollera nätet och försök igen.',
      )
      setBusy(false)
    }
  }

  return (
    <main className="page page--admin admin-center">
      <Card className="admin-login">
        <span className="admin-brand">
          Glöggmingel <span className="admin-badge">Admin</span>
        </span>
        <h1>{title}</h1>
        <p className="muted">Logga in som värd för att fortsätta.</p>
        <form className="admin-form" onSubmit={onSubmit} noValidate>
          <label htmlFor={emailId}>E-post</label>
          <input
            id={emailId}
            className="input"
            type="email"
            autoComplete="username"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            disabled={busy}
            aria-describedby={error ? errorId : undefined}
          />
          <label htmlFor={passwordId}>Lösenord</label>
          <input
            id={passwordId}
            className="input"
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            disabled={busy}
            aria-describedby={error ? errorId : undefined}
          />
          {error && (
            <p id={errorId} role="alert" className="form-error">
              {error}
            </p>
          )}
          <Button type="submit" block disabled={busy}>
            {busy ? 'Loggar in…' : 'Logga in'}
          </Button>
        </form>
      </Card>
    </main>
  )
}

/** Loggar ut admin. AdminGate visar då inloggningen igen. */
export function SignOutButton() {
  return (
    <Button variant="secondary" size="small" onClick={() => void signOut()}>
      Logga ut
    </Button>
  )
}
