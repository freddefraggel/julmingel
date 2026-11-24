import { get, ref, serverTimestamp, update } from 'firebase/database'
import type { Answer, Choice, EventSecret, QuestionTiming } from '../types'
import { eventPath, subscribe, type OnError } from './db'
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

/** Svaren på en fråga, uid → { choice, at }. Bara admin får läsa alla. */
export function subscribeAnswers(
  eventId: string,
  qId: string,
  callback: (answers: Record<string, Answer>) => void,
  onError?: OnError,
): () => void {
  return subscribe<Record<string, Answer>>(eventPath(eventId, 'answers', qId), (answers) => callback(answers ?? {}), onError)
}

/** Facit, qId → rätt svar. Bara admin får läsa det. */
export function subscribeCorrect(
  eventId: string,
  callback: (correct: Record<string, Choice>) => void,
  onError?: OnError,
): () => void {
  return subscribe<Record<string, Choice>>(eventPath(eventId, 'secret', 'correct'), (correct) => callback(correct ?? {}), onError)
}
