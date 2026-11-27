import { ref, set } from 'firebase/database'
import type { GloggNumber, GuestNotes } from '../types'
import { NOTE_MAX_LENGTH } from '../types'
import { eventPath, subscribe, type OnError } from './db'
import { firebase } from './firebase'

/** Gästens egna anteckningar, notes/{uid}: nummer → fritext. Tomt om gästen inte har skrivit något. */
export function subscribeNotes(
  eventId: string,
  uid: string,
  callback: (notes: GuestNotes) => void,
  onError?: OnError,
): () => void {
  return subscribe<GuestNotes | (string | null)[]>(
    eventPath(eventId, 'notes', uid),
    (notes) => {
      // Nycklarna 1, 2, 3 kan komma tillbaka som en lista med en tom plats på index 0.
      const result: GuestNotes = {}
      for (const [number, text] of Object.entries(notes ?? {})) if (typeof text === 'string' && text) result[number] = text
      callback(result)
    },
    onError,
  )
}

/**
 * Sparar gästens anteckning på ett nummer. Tom text (eller bara blanksteg) tar
 * bort anteckningen. Databasreglerna godkänner det bara medan provningen i
 * gästens klass är öppen, och högst 500 tecken.
 */
export function saveNote(eventId: string, uid: string, number: GloggNumber, text: string): Promise<void> {
  const value = text.trim() ? text.slice(0, NOTE_MAX_LENGTH) : null
  return set(ref(firebase().db, eventPath(eventId, 'notes', uid, number)), value)
}
