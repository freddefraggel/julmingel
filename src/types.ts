// Delade typer för datamodellen i docs/spec.md. Allt för en kväll ligger under /events/{eventId}.

/** Gästens klass: vanlig glögg eller alkoholfri. */
export type GuestClass = 'vanlig' | 'alkfri'

/** Kvällens fas, som admin skriver till `live/phase`. */
export type Phase = 'registration' | 'tasting' | 'quiz' | 'review' | 'guess' | 'reveal' | 'done'

/** Svarsalternativ i en quizfråga. */
export type Choice = 'A' | 'B' | 'C' | 'D'

/** Tidpunkt i millisekunder enligt serverns klocka (`ServerValue.TIMESTAMP`). */
export type ServerTime = number

/** Glöggens nummer i serveringsordningen, inom en klass. Nycklar i databasen är strängar: "1", "2", … */
export type GloggNumber = string

// ── config/: admin skriver, gäster läser ────────────────────────────────────

export type Criterion = {
  name: string
  order: number
  /** Lågt värde är bra (t.ex. sötma). Räknas som 6 − värdet i Kvällens glögg. */
  lowIsGood: boolean
}

export type Glogg = {
  class: GuestClass
  name: string
  description: string
  imageId?: string
}

export type Song = {
  order: number
  /** `spotify:track:<id>` */
  spotifyUri: string
  startMs: number
  secondsPerQuestion: number
}

export type Question = {
  songId: string
  order: number
  text: string
  answerType: 'text' | 'image'
  /** Text, eller imageId när answerType är "image". */
  options: Record<Choice, string>
}

export type EventConfig = {
  name: string
  joinOpen: boolean
  criteria?: Record<string, Criterion>
  gloggs?: Record<string, Glogg>
  songs?: Record<string, Song>
  questions?: Record<string, Question>
}

// ── secret/: bara admin ─────────────────────────────────────────────────────

export type EventSecret = {
  /** Kvällens lösenord, ligger i QR-koden. */
  joinCode: string
  correct?: Record<string, Choice>
  /** Serveringsordningen: klass → nummer → gId. */
  numbers?: Partial<Record<GuestClass, Record<GloggNumber, string>>>
  /** Hela topplistan före avslöjandet. */
  leaderboard?: Record<string, LeaderboardEntry>
}

// ── live/: admin skriver, alla läser ────────────────────────────────────────

export type TastingState = {
  serving: number | null
  next: number | null
}

export type LiveQuiz = {
  qId: string
  openedAt: ServerTime
  durationMs: number
}

export type LiveState = {
  phase: Phase
  /** ”Just nu: …” */
  nowText?: string
  tasting?: Partial<Record<GuestClass, TastingState>>
  quiz?: LiveQuiz
  review?: { qId: string }
  /** 0–4: vid steg 1–4 avslöjas 4:an, 3:an, 2:an och vinnaren. */
  reveal?: { step: 0 | 1 | 2 | 3 | 4 }
}

// ── reveal/: admin kopierar hit vid avslöjandet ─────────────────────────────

export type EventReveal = {
  correct?: Record<string, Choice>
  numbers?: Partial<Record<GuestClass, Record<GloggNumber, string>>>
}

// ── Gästernas egna noder ────────────────────────────────────────────────────

export type Guest = {
  name: string
  class: GuestClass
  joinCode: string
  joinedAt: ServerTime
}

/** ratings/{uid}/{number}/{cId}: 1–5 */
export type Rating = 1 | 2 | 3 | 4 | 5
export type GuestRatings = Record<GloggNumber, Record<string, Rating>>

export type Answer = {
  choice: Choice
  at: ServerTime
}

export type Guess = {
  /** nummer → gId */
  map: Record<GloggNumber, string>
  locked: boolean
}

// ── results/: admin beräknar och skriver ────────────────────────────────────

export type LeaderboardEntry = {
  points: number
  stars: number
  rank: number
}

export type GloggOfEvening = {
  gId: string
  avg: number
}

export type EventResults = {
  leaderboard?: Record<string, LeaderboardEntry>
  gloggOfEvening?: Partial<Record<GuestClass, GloggOfEvening>>
}

// ── Hela eventet ────────────────────────────────────────────────────────────

/** /events/{eventId} */
export type GloggEvent = {
  config: EventConfig
  /** imageId → "data:image/webp;base64,…", eller en https-länk när sajten blockerade hämtningen (CORS). */
  assets?: Record<string, string>
  secret: EventSecret
  live: LiveState
  reveal?: EventReveal
  guests?: Record<string, Guest>
  ratings?: Record<string, GuestRatings>
  /** qId → uid → svar */
  answers?: Record<string, Record<string, Answer>>
  guesses?: Record<string, Guess>
  results?: EventResults
}
