import { onAuthStateChanged, signInAnonymously, signInWithEmailAndPassword, signOut as fbSignOut } from 'firebase/auth'
import { firebase } from './firebase'

export type SignedInUser = { uid: string; isAnonymous: boolean }

/** Gäst: anonym inloggning. SDK:n sparar uid i IndexedDB, så en omladdning ger samma gäst. */
export async function signInGuest(): Promise<SignedInUser> {
  const { user } = await signInAnonymously(firebase().auth)
  return { uid: user.uid, isAnonymous: true }
}

/** Admin: e-post och lösenord. Kontot måste också finnas under /admins/{uid}. */
export async function signInAdmin(email: string, password: string): Promise<SignedInUser> {
  const { user } = await signInWithEmailAndPassword(firebase().auth, email, password)
  return { uid: user.uid, isAnonymous: false }
}

export function signOut(): Promise<void> {
  return fbSignOut(firebase().auth)
}

/** Anropas med inloggad användare, eller null. Returnerar en funktion som avslutar prenumerationen. */
export function onUserChanged(callback: (user: SignedInUser | null) => void): () => void {
  return onAuthStateChanged(firebase().auth, (user) =>
    callback(user ? { uid: user.uid, isAnonymous: user.isAnonymous } : null),
  )
}

/** Om inloggningen misslyckades på grund av fel e-post eller lösenord (och inte t.ex. nätet). */
export function isWrongCredentials(error: unknown): boolean {
  const code = (error as { code?: unknown } | null)?.code
  return (
    typeof code === 'string' &&
    ['auth/invalid-credential', 'auth/wrong-password', 'auth/user-not-found', 'auth/invalid-email'].includes(code)
  )
}
