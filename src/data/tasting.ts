import { ref, set } from 'firebase/database'
import type { EventSecret, GuestClass, GuestRatings, TastingState } from '../types'
import { eventPath, subscribe, type OnError } from './db'
import { firebase } from './firebase'

type Numbers = NonNullable<EventSecret['numbers']>

/** Serveringsordningen, klass → nummer → gId. Bara admin får läsa den. */
export function subscribeNumbers(eventId: string, callback: (numbers: Numbers) => void, onError?: OnError): () => void {
  return subscribe<Numbers>(eventPath(eventId, 'secret', 'numbers'), (numbers) => callback(numbers ?? {}), onError)
}

/** Alla gästers betyg, uid → nummer → kriterium → 1–5. Bara admin får läsa alla. */
export function subscribeAllRatings(
  eventId: string,
  callback: (ratings: Record<string, GuestRatings>) => void,
  onError?: OnError,
): () => void {
  return subscribe<Record<string, GuestRatings>>(eventPath(eventId, 'ratings'), (ratings) => callback(ratings ?? {}), onError)
}

/**
 * Vad som serveras och förbereds i en klass: en skrivning till `live/tasting/{class}`.
 * Gästernas mobiler hoppar till numret i `serving`.
 */
export function setTasting(eventId: string, guestClass: GuestClass, state: TastingState): Promise<void> {
  return set(ref(firebase().db, eventPath(eventId, 'live', 'tasting', guestClass)), state)
}
