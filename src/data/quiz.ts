import { get, ref, serverTimestamp, set, update } from 'firebase/database'
import type { Answer, AnsweredCount, Choice, EventReveal, EventSecret, QuestionTiming } from '../types'
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

/** Gästens eget svar på en fråga, eller null. */
export function subscribeOwnAnswer(
  eventId: string,
  qId: string,
  uid: string,
  callback: (answer: Answer | null) => void,
  onError?: OnError,
): () => void {
  return subscribe<Answer>(eventPath(eventId, 'answers', qId, uid), callback, onError)
}

/**
 * Gästens svar. Tiden sätts av servern, och databasreglerna nekar svaret om
 * frågan inte är den öppna eller om tiden är ute. Varje byte skriver om svaret.
 */
export function sendAnswer(eventId: string, qId: string, uid: string, choice: Choice): Promise<void> {
  return set(ref(firebase().db, eventPath(eventId, 'answers', qId, uid)), { choice, at: serverTimestamp() })
}

/** Admin: hur många som har svarat, till gästernas ”Har svarat x av y”. */
export function setAnsweredCount(eventId: string, answered: AnsweredCount): Promise<void> {
  return set(ref(firebase().db, eventPath(eventId, 'live', 'answered')), answered)
}

/**
 * Rättning: visar en fråga för gästerna. Rätt svar kopieras från secret/ till
 * reveal/ i samma anrop, så att det syns först när frågan gås igenom.
 */
export function showReview(eventId: string, qId: string, correct: Choice): Promise<void> {
  return update(ref(firebase().db, eventPath(eventId)), {
    'live/review': { qId },
    [`reveal/correct/${qId}`]: correct,
  })
}

/** Det som admin har avslöjat: rätt svar och glöggernas nummer. Gäster får läsa det. */
export function subscribeReveal(eventId: string, callback: (reveal: EventReveal) => void, onError?: OnError): () => void {
  return subscribe<EventReveal>(eventPath(eventId, 'reveal'), (reveal) => callback(reveal ?? {}), onError)
}
