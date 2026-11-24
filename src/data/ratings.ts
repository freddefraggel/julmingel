import { ref, update } from 'firebase/database'
import type { GloggNumber, GuestRatings, Rating } from '../types'
import { eventPath, subscribe, type OnError } from './db'
import { firebase } from './firebase'

/** Gästens egna betyg, ratings/{uid}: nummer → kriterium → 1–5. Tomt om gästen inte har betygsatt något. */
export function subscribeOwnRatings(
  eventId: string,
  uid: string,
  callback: (ratings: GuestRatings) => void,
  onError?: OnError,
): () => void {
  return subscribe<GuestRatings>(eventPath(eventId, 'ratings', uid), (ratings) => callback(ratings ?? {}), onError)
}

/**
 * Sparar gästens betyg på ett nummer, kriterium → 1–5, i ett anrop.
 * Databasreglerna godkänner det bara under glöggprovningen.
 */
export function saveRatings(
  eventId: string,
  uid: string,
  number: GloggNumber,
  values: Record<string, Rating>,
): Promise<void> {
  return update(ref(firebase().db, eventPath(eventId, 'ratings', uid, number)), values)
}
