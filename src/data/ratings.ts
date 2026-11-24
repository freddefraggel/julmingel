import type { GuestRatings } from '../types'
import { eventPath, subscribe, type OnError } from './db'

/** Gästens egna betyg, ratings/{uid}: nummer → kriterium → 1–5. Tomt om gästen inte har betygsatt något. */
export function subscribeOwnRatings(
  eventId: string,
  uid: string,
  callback: (ratings: GuestRatings) => void,
  onError?: OnError,
): () => void {
  return subscribe<GuestRatings>(eventPath(eventId, 'ratings', uid), (ratings) => callback(ratings ?? {}), onError)
}
