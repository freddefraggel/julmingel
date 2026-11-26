import { get, ref, serverTimestamp, set, update } from 'firebase/database'
import { createChanges, type EventIndexEntry, type EventSource, type NewEvent } from '../admin/events'
import type { EventConfig, EventSecret } from '../types'
import { eventPath, subscribe, type OnError } from './db'
import { firebase } from './firebase'

/** Registret över kvällar, `/eventIndex/{id}`. Bara admin får läsa det. */
export function subscribeEventIndex(
  callback: (index: Record<string, EventIndexEntry>) => void,
  onError?: OnError,
): () => void {
  return subscribe<Record<string, EventIndexEntry>>('eventIndex', (index) => callback(index ?? {}), onError)
}

/** Lägger in eller uppdaterar kvällen i registret, t.ex. när den öppnas eller döps om. */
export function touchEventIndex(eventId: string, name: string): Promise<void> {
  return set(ref(firebase().db, `eventIndex/${eventId}`), { name, updatedAt: serverTimestamp() })
}

/** Om det redan finns en kväll med id:t (varje kväll har en kod i secret/joinCode). */
export async function eventExists(eventId: string): Promise<boolean> {
  return (await get(ref(firebase().db, eventPath(eventId, 'secret', 'joinCode')))).exists()
}

/**
 * Skapar en ny kväll i ett anrop, eventuellt med förberedelserna kopierade
 * från en annan kväll (se createChanges i src/admin/events.ts).
 */
export async function createEvent(input: NewEvent, copyFrom: string | null): Promise<void> {
  const db = firebase().db
  let source: EventSource | null = null
  if (copyFrom) {
    const read = (...parts: string[]) => get(ref(db, eventPath(copyFrom, ...parts))).then((s) => s.val())
    const [config, assets, numbers, correct] = await Promise.all([
      read('config') as Promise<EventConfig | null>,
      read('assets') as Promise<Record<string, string> | null>,
      read('secret', 'numbers') as Promise<EventSecret['numbers'] | null>,
      read('secret', 'correct') as Promise<EventSecret['correct'] | null>,
    ])
    source = { config, assets, numbers, correct }
  }
  await update(ref(db), createChanges(input, source, Date.now()))
}
