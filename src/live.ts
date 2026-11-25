// Hjälpfunktioner för live/: kvällens tre lägen (#55). Rena funktioner utan Firebase.
import type { LiveState, QuestionTiming, Stage, WrapupStep } from './types'

/** Kvällens tre lägen i ordning, som knapparna överst i kontrollpanelen. */
export const STAGES: readonly { stage: Exclude<Stage, 'done'>; label: string }[] = [
  { stage: 'lobby', label: 'Innan start' },
  { stage: 'evening', label: 'Kvällen pågår' },
  { stage: 'wrapup', label: 'Rättning och avslöjande' },
]

/** Stegen i rättning och avslöjande, plus Klart (`live/stage = "done"`). */
export const WRAPUP_STEPS: readonly { step: WrapupStep | 'done'; label: string }[] = [
  { step: 'review', label: 'Rättning' },
  { step: 'guess', label: 'Gissa glöggen' },
  { step: 'reveal', label: 'Avslöjande' },
  { step: 'done', label: 'Klart' },
]

/** Platsen i ordningen: innan start 0, kvällen 1, avslutningen och klart 2. undefined utan live/. */
export function stageIndex(stage: Stage | undefined): number {
  if (stage === 'done') return 2
  return STAGES.findIndex((s) => s.stage === stage)
}

/**
 * Skrivningarna när admin byter kvällens läge, i ett anrop. Rättning och
 * avslöjande stänger provningen och en låt eller fråga som pågår, och börjar
 * med rättningen om inget steg är valt.
 */
export function stageChanges(stage: Stage, live: LiveState | null | undefined): Record<string, unknown> {
  if (stage !== 'wrapup') return { 'live/stage': stage }
  const changes: Record<string, unknown> = {
    'live/stage': 'wrapup',
    'live/wrapup/step': live?.wrapup?.step ?? 'review',
    'live/tasting/vanlig/open': false,
    'live/tasting/alkfri/open': false,
  }
  const state = live?.quiz?.state
  if (state === 'playing' || state === 'open') changes['live/quiz/state'] = 'closed'
  return changes
}

/** Skrivningarna för ett steg i avslutningen. Klart sätter `live/stage = "done"`. */
export function wrapupStepChanges(step: WrapupStep | 'done'): Record<string, unknown> {
  if (step === 'done') return { 'live/stage': 'done' }
  return { 'live/stage': 'wrapup', 'live/wrapup/step': step }
}

/** Frågans tider, om den har visats (`openedAt` och `durationMs` finns). */
export function quizTiming(live: LiveState | null | undefined): QuestionTiming | null {
  const quiz = live?.quiz
  if (!quiz || typeof quiz.openedAt !== 'number' || typeof quiz.durationMs !== 'number') return null
  return { openedAt: quiz.openedAt, durationMs: quiz.durationMs }
}

/**
 * Skrivningarna för *Nollställ kvällen*: allt som gästerna och kvällen har
 * skrivit tas bort i ett anrop, men inte förberedelserna (config/, assets/,
 * kod, glöggordning och facit). Utan live/ visar kontrollpanelen att kvällen
 * inte har börjat.
 */
export function resetChanges(includeGuests: boolean): Record<string, null> {
  const changes: Record<string, null> = {
    ratings: null,
    answers: null,
    guesses: null,
    results: null,
    reveal: null,
    'secret/quizTimes': null,
    'secret/leaderboard': null,
    live: null,
  }
  if (includeGuests) changes.guests = null
  return changes
}
