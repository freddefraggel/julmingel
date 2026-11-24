import { ref, set } from 'firebase/database'
import type { EventSecret, Guess } from '../types'
import { eventPath, subscribe, type OnError } from './db'
import { firebase } from './firebase'

/** Gästens egen gissning, eller null. */
export function subscribeOwnGuess(
  eventId: string,
  uid: string,
  callback: (guess: Guess | null) => void,
  onError?: OnError,
): () => void {
  return subscribe<Guess>(eventPath(eventId, 'guesses', uid), callback, onError)
}

/**
 * Sparar gästens gissning, nummer → gId. Reglerna godkänner det bara i fasen
 * `guess` och bara så länge gissningen inte är låst.
 */
export function saveGuess(eventId: string, uid: string, guess: Guess): Promise<void> {
  return set(ref(firebase().db, eventPath(eventId, 'guesses', uid)), guess)
}

/** Admin: alla gissningar, uid → gissning. */
export function subscribeAllGuesses(
  eventId: string,
  callback: (guesses: Record<string, Guess>) => void,
  onError?: OnError,
): () => void {
  return subscribe<Record<string, Guess>>(eventPath(eventId, 'guesses'), (guesses) => callback(guesses ?? {}), onError)
}

/** Admin: avslöjar glöggordningen genom att kopiera secret/numbers till reveal/numbers. */
export function revealNumbers(eventId: string, numbers: NonNullable<EventSecret['numbers']>): Promise<void> {
  return set(ref(firebase().db, eventPath(eventId, 'reveal', 'numbers')), numbers)
}
