import { get, ref, set, update } from 'firebase/database'
import { phaseChanges, type Phase } from '../live'
import type { Guest, GuestClass, Stage, WrapupStep } from '../types'
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

/** Kvällens läge: `live/stage`. */
export function setStage(eventId: string, stage: Stage): Promise<void> {
  return set(ref(firebase().db, eventPath(eventId, 'live', 'stage')), stage)
}

/** Steget i rättning och avslöjande: `live/wrapup/step`. */
export function setWrapupStep(eventId: string, step: WrapupStep): Promise<void> {
  return set(ref(firebase().db, eventPath(eventId, 'live', 'wrapup', 'step')), step)
}

/**
 * Den gamla faslistan i kontrollpanelen, översatt till de tre lägena i ett
 * anrop (se phaseChanges i src/live.ts). Ersätts när kontrollpanelen byggs om (#57).
 */
export function setPhase(eventId: string, phase: Phase): Promise<void> {
  return update(ref(firebase().db, eventPath(eventId)), phaseChanges(phase))
}

/** Öppnar eller stänger registreringen (`config/joinOpen`). */
export function setJoinOpen(eventId: string, open: boolean): Promise<void> {
  return set(ref(firebase().db, eventPath(eventId, 'config', 'joinOpen')), open)
}

/**
 * Byter gästens klass. Betygen gäller numren i den gamla klassen och räknas
 * inte i den nya, så de tas bort i samma skrivning.
 */
export function changeGuestClass(eventId: string, uid: string, guestClass: GuestClass): Promise<void> {
  return update(ref(firebase().db, eventPath(eventId)), {
    [`guests/${uid}/class`]: guestClass,
    [`ratings/${uid}`]: null,
  })
}

/**
 * Tar bort en gäst, t.ex. en dubblett när någon har bytt webbläsare.
 * Allt gästen har skrivit försvinner i samma skrivning: betyg, svar och gissningar.
 */
export async function removeGuest(eventId: string, uid: string): Promise<void> {
  const db = firebase().db
  const answers = await get(ref(db, eventPath(eventId, 'answers')))
  const changes: Record<string, null> = {
    [`guests/${uid}`]: null,
    [`ratings/${uid}`]: null,
    [`guesses/${uid}`]: null,
    [`results/leaderboard/${uid}`]: null,
  }
  answers.forEach((question) => {
    if (question.hasChild(uid)) changes[`answers/${question.key}/${uid}`] = null
  })
  await update(ref(db, eventPath(eventId)), changes)
}
