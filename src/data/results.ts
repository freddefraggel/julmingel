import { get, ref, update } from 'firebase/database'
import type { Answer, Choice, EventResults, EventSecret, GuestRatings, QuestionTiming } from '../types'
import { eventPath, subscribe, type OnError } from './db'
import { firebase } from './firebase'

export type ResultsInput = {
  answers: Record<string, Record<string, Answer>>
  correct: Record<string, Choice>
  quizTimes: Record<string, QuestionTiming>
  ratings: Record<string, GuestRatings>
  numbers: NonNullable<EventSecret['numbers']>
}

/** Admin: allt som score() och gloggOfEvening() behöver, läst en gång. */
export async function loadResultsInput(eventId: string): Promise<ResultsInput> {
  const db = firebase().db
  const read = (...parts: string[]) => get(ref(db, eventPath(eventId, ...parts))).then((s) => s.val() ?? {})
  const [answers, correct, quizTimes, ratings, numbers] = await Promise.all([
    read('answers'),
    read('secret', 'correct'),
    read('secret', 'quizTimes'),
    read('ratings'),
    read('secret', 'numbers'),
  ])
  return { answers, correct, quizTimes, ratings, numbers }
}

/** Admin: flera skrivningar under /events/{eventId} i ett anrop, t.ex. ett steg i avslöjandet. */
export function writeResults(eventId: string, changes: Record<string, unknown>): Promise<void> {
  return update(ref(firebase().db, eventPath(eventId)), changes)
}

/** Topplistan och Kvällens glögg, så långt de är avslöjade. Gäster får läsa dem. */
export function subscribeResults(eventId: string, callback: (results: EventResults) => void, onError?: OnError): () => void {
  return subscribe<EventResults>(eventPath(eventId, 'results'), (results) => callback(results ?? {}), onError)
}
