import type { Phase } from '../live'

export type PhaseInfo = { phase: Phase; label: string; sub: string }

/** Kvällens flöde i ordning, som knapparna i kontrollpanelen. */
export const PHASES: readonly PhaseInfo[] = [
  { phase: 'registration', label: 'Registrering', sub: 'QR-kod på skärmen' },
  { phase: 'tasting', label: 'Glöggprovning', sub: 'Ranka öppen' },
  { phase: 'quiz', label: 'Musikquiz', sub: 'Låtar och frågor' },
  { phase: 'review', label: 'Rättning', sub: 'Gå igenom rätt svar' },
  { phase: 'guess', label: 'Gissa glöggen', sub: 'Öppna gissningar' },
  { phase: 'reveal', label: 'Avslöjande', sub: 'Topplista, 4:an → 1:an' },
  { phase: 'done', label: 'Klart', sub: 'Tack för i kväll' },
]

export function phaseIndex(phase: Phase | undefined): number {
  return PHASES.findIndex((p) => p.phase === phase)
}
