import { get, ref, set, update } from 'firebase/database'
import { stageChanges, wrapupStepChanges } from '../live'
import type { Guest, GuestClass, LiveState, Stage, WrapupStep } from '../types'
import { eventPath, subscribe, type OnError } from './db'
import { firebase } from './firebase'
import { isPermissionDenied } from './errors'

export type AdminEventResult =
  | { ok: true; name: string; joinCode: string }
  | { ok: false; reason: 'not-admin' | 'no-event' | 'error' }

/**
 * Öppnar ett event som admin. `secret/` kan bara admin läsa, så läsningen säger
 * samtidigt om kontot finns under /admins: ett nej betyder att det inte gör det.
 */
export async function openAdminEvent(eventId: string): Promise<AdminEventResult> {
  try {
    const [joinCode, name] = await Promise.all([
      get(ref(firebase().db, eventPath(eventId, 'secret', 'joinCode'))),
      get(ref(firebase().db, eventPath(eventId, 'config', 'name'))),
    ])
    if (!joinCode.exists()) return { ok: false, reason: 'no-event' }
    return { ok: true, joinCode: String(joinCode.val()), name: name.exists() ? String(name.val()) : eventId }
  } catch (error) {
    return { ok: false, reason: isPermissionDenied(error) ? 'not-admin' : 'error' }
  }
}

/** Alla gäster i eventet, uid → gäst. Bara admin får läsa hela listan. */
export function subscribeGuests(
  eventId: string,
  callback: (guests: Record<string, Guest>) => void,
  onError?: OnError,
): () => void {
  return subscribe<Record<string, Guest>>(eventPath(eventId, 'guests'), (guests) => callback(guests ?? {}), onError)
}

/**
 * Kvällens läge, `live/stage`, i ett anrop. Rättning och avslöjande stänger
 * också provningen och en låt eller fråga som pågår (se stageChanges i src/live.ts).
 */
export function setStage(eventId: string, stage: Stage, live?: LiveState | null): Promise<void> {
  return update(ref(firebase().db, eventPath(eventId)), stageChanges(stage, live))
}

/** Steget i rättning och avslöjande, `live/wrapup/step`, eller Klart (`live/stage = "done"`). */
export function setWrapupStep(eventId: string, step: WrapupStep | 'done'): Promise<void> {
  return update(ref(firebase().db, eventPath(eventId)), wrapupStepChanges(step))
}

/** Öppnar eller stänger registreringen (`config/joinOpen`). */
export function setJoinOpen(eventId: string, open: boolean): Promise<void> {
  return set(ref(firebase().db, eventPath(eventId, 'config', 'joinOpen')), open)
}

/**
 * Byter gästens klass. Betygen och anteckningarna gäller numren i den gamla
 * klassen och räknas inte i den nya, så de tas bort i samma skrivning.
 */
export function changeGuestClass(eventId: string, uid: string, guestClass: GuestClass): Promise<void> {
  return update(ref(firebase().db, eventPath(eventId)), {
    [`guests/${uid}/class`]: guestClass,
    [`ratings/${uid}`]: null,
    [`notes/${uid}`]: null,
  })
}

/**
 * Tar bort en gäst, t.ex. en dubblett när någon har bytt webbläsare.
 * Allt gästen har skrivit försvinner i samma skrivning: betyg, anteckningar, svar och gissningar.
 */
export async function removeGuest(eventId: string, uid: string): Promise<void> {
  const db = firebase().db
  const answers = await get(ref(db, eventPath(eventId, 'answers')))
  const changes: Record<string, null> = {
    [`guests/${uid}`]: null,
    [`ratings/${uid}`]: null,
    [`notes/${uid}`]: null,
    [`guesses/${uid}`]: null,
    [`results/leaderboard/${uid}`]: null,
  }
  answers.forEach((question) => {
    if (question.hasChild(uid)) changes[`answers/${question.key}/${uid}`] = null
  })
  await update(ref(db, eventPath(eventId)), changes)
}
