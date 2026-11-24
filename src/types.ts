// Delade typer för datamodellen i docs/spec.md. Fylls på i takt med att funktionerna byggs.

/** Gästens klass: vanlig glögg eller alkoholfri. */
export type GuestClass = 'vanlig' | 'alkfri'

/** Kvällens fas, som admin skriver till `live/phase`. */
export type Phase = 'registration' | 'tasting' | 'quiz' | 'review' | 'guess' | 'reveal' | 'done'

/** Svarsalternativ i en quizfråga. */
export type Choice = 'A' | 'B' | 'C' | 'D'
