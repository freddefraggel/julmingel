// Hjälpfunktioner för live/: kvällens tre lägen (#55). Rena funktioner utan Firebase.
//
// phaseOf är en brygga för gästens vyer, som fortfarande tänker i en gemensam
// fas; den försvinner när gästsidan byggs om (#58, #59).
import type { LiveState, QuestionTiming, Stage, WrapupStep } from './types'

/** Den gamla fasen, härledd från live/. */
export type Phase = 'registration' | 'tasting' | 'quiz' | 'review' | 'guess' | 'reveal' | 'done'

/**
 * Fasen som gästens vyer visar. Under kvällen räknas quizet som aktivt när en
 * låt spelar eller en fråga visas eller har stängts; annars är det provningen.
 * undefined när live/ saknas.
 */
export function phaseOf(live: LiveState | null | undefined): Phase | undefined {
  switch (live?.stage) {
    case 'lobby':
      return 'registration'
    case 'evening': {
      const state = live.quiz?.state
      return state === 'playing' || state === 'open' || state === 'closed' ? 'quiz' : 'tasting'
    }
    case 'wrapup':
      return live.wrapup?.step ?? 'review'
    case 'done':
      return 'done'
    default:
      return undefined
  }
}

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
