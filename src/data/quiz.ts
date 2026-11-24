import { get, ref, serverTimestamp, update } from 'firebase/database'
import type { EventSecret, QuestionTiming } from '../types'
import { eventPath } from './db'
import { firebase } from './firebase'

/**
 * Öppnar en fråga genom att skriva `live/quiz` och `secret/quizTimes/{qId}` i
 * samma anrop. Båda får samma `ServerValue.TIMESTAMP`, och databasreglerna
 * nekar `live/quiz` om tiderna inte stämmer med `secret/quizTimes`. Öppnas
 * samma fråga igen gäller den nya tiden.
 */
export function openQuestion(eventId: string, qId: string, durationMs: number): Promise<void> {
  const timing = { openedAt: serverTimestamp(), durationMs }
  return update(ref(firebase().db, eventPath(eventId)), {
    'live/quiz': { qId, ...timing },
    [`secret/quizTimes/${qId}`]: timing,
  })
}

/** Tiderna för alla frågor som har öppnats, till score(). Bara admin får läsa dem. */
export async function getQuizTimes(eventId: string): Promise<Record<string, QuestionTiming>> {
  const snapshot = await get(ref(firebase().db, eventPath(eventId, 'secret', 'quizTimes')))
  return (snapshot.val() as EventSecret['quizTimes'] | null) ?? {}
}
