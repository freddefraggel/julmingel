import { get, ref, serverTimestamp, set } from 'firebase/database'
import type { Guest, GuestClass } from '../types'
import { signInGuest } from './auth'
import { eventPath, subscribe, type OnError } from './db'
import { isPermissionDenied } from './errors'
import { firebase } from './firebase'

/** Gästens egen post, eller null om gästen inte har gått med i eventet. */
export async function getOwnGuest(eventId: string, uid: string): Promise<Guest | null> {
  const snapshot = await get(ref(firebase().db, eventPath(eventId, 'guests', uid)))
  return snapshot.exists() ? (snapshot.val() as Guest) : null
}

/**
 * Om registreringen är öppen. `config/joinOpen` får läsas av alla inloggade,
 * så att gästen kan få rätt felmeddelande innan den har gått med.
 * Ger null om eventet inte finns.
 */
export async function isJoinOpen(eventId: string): Promise<boolean | null> {
  const snapshot = await get(ref(firebase().db, eventPath(eventId, 'config', 'joinOpen')))
  return snapshot.exists() ? snapshot.val() === true : null
}

export type JoinRequest = { name: string; class: GuestClass; joinCode: string }

export type JoinResult = { ok: true; guest: Guest } | { ok: false; reason: 'closed' | 'wrong-code' | 'no-event' | 'error' }

/** Skriver guests/{uid}. Reglerna jämför joinCode med secret/joinCode, som gästen själv inte kan läsa. */
export async function joinEvent(eventId: string, uid: string, request: JoinRequest): Promise<JoinResult> {
  const open = await isJoinOpen(eventId).catch(() => undefined)
  if (open === undefined) return { ok: false, reason: 'error' }
  if (open === null) return { ok: false, reason: 'no-event' }
  if (!open) return { ok: false, reason: 'closed' }

  try {
    await set(ref(firebase().db, eventPath(eventId, 'guests', uid)), {
      name: request.name,
      class: request.class,
      joinCode: request.joinCode,
      joinedAt: serverTimestamp(),
    })
  } catch (error) {
    // Registreringen är öppen och namnet är kontrollerat, så ett nej från reglerna betyder fel kod.
    return { ok: false, reason: isPermissionDenied(error) ? 'wrong-code' : 'error' }
  }

  const guest = await getOwnGuest(eventId, uid)
  return guest ? { ok: true, guest } : { ok: false, reason: 'error' }
}

/**
 * Gästens egen post, uppdateras när admin byter klass. Ger null om admin har
 * tagit bort gästen.
 */
export function subscribeOwnGuest(
  eventId: string,
  uid: string,
  callback: (guest: Guest | null) => void,
  onError?: OnError,
): () => void {
  return subscribe<Guest>(eventPath(eventId, 'guests', uid), callback, onError)
}

/**
 * Kvällens namn till registreringen, innan gästen har gått med. Loggar in
 * anonymt (eller återanvänder inloggningen) och läser `config/name`, som alla
 * inloggade får läsa. null om namnet saknas eller inte går att läsa.
 */
export async function getEventName(eventId: string): Promise<string | null> {
  try {
    await signInGuest()
    const snapshot = await get(ref(firebase().db, eventPath(eventId, 'config', 'name')))
    return snapshot.exists() ? String(snapshot.val()) : null
  } catch {
    return null
  }
}
