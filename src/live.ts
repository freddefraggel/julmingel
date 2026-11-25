// Brygga mellan de tre oberoende lägena i live/ (#55) och vyerna som fortfarande
// tänker i en gemensam fas. Vyerna byggs om i #56–#59; då försvinner bryggan.
// Rena funktioner utan Firebase.
import type { LiveState, QuestionTiming } from './types'

/** Den gamla fasen, härledd från live/. */
export type Phase = 'registration' | 'tasting' | 'quiz' | 'review' | 'guess' | 'reveal' | 'done'

/**
 * Fasen som vyerna visar. Under kvällen räknas quizet som aktivt så fort
 * `live/quiz` finns; annars är det provningen. undefined när live/ saknas.
 */
export function phaseOf(live: LiveState | null | undefined): Phase | undefined {
  switch (live?.stage) {
    case 'lobby':
      return 'registration'
    case 'evening':
      return live.quiz ? 'quiz' : 'tasting'
    case 'wrapup':
      return live.wrapup?.step ?? 'review'
    case 'done':
      return 'done'
    default:
      return undefined
  }
}

/**
 * Skrivningarna under live/ när admin väljer en fas i den gamla faslistan.
 * Provningen öppnas i båda klasserna, quizet stänger provningen, och
 * rättningen stänger quizet – samma flöde som tidigare.
 */
export function phaseChanges(phase: Phase): Record<string, unknown> {
  const tasting = (open: boolean) => ({ 'live/tasting/vanlig/open': open, 'live/tasting/alkfri/open': open })
  switch (phase) {
    case 'registration':
      return { 'live/stage': 'lobby', ...tasting(false), 'live/quiz': null }
    case 'tasting':
      return { 'live/stage': 'evening', ...tasting(true), 'live/quiz': null }
    case 'quiz':
      return { 'live/stage': 'evening', ...tasting(false), 'live/quiz/state': 'idle' }
    case 'review':
    case 'guess':
    case 'reveal':
      return { 'live/stage': 'wrapup', ...tasting(false), 'live/quiz': null, 'live/wrapup/step': phase }
    case 'done':
      return { 'live/stage': 'done', ...tasting(false), 'live/quiz': null }
  }
}

/** Frågans tider, om den har visats (`openedAt` och `durationMs` finns). */
export function quizTiming(live: LiveState | null | undefined): QuestionTiming | null {
  const quiz = live?.quiz
  if (!quiz || typeof quiz.openedAt !== 'number' || typeof quiz.durationMs !== 'number') return null
  return { openedAt: quiz.openedAt, durationMs: quiz.durationMs }
}
