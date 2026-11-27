// Delade typer för datamodellen i docs/spec.md. Allt för en kväll ligger under /events/{eventId}.

/** Gästens klass: vanlig glögg eller alkoholfri. */
export type GuestClass = 'vanlig' | 'alkfri'

/**
 * Kvällens läge, `live/stage`: innan start, pågår (provning och quiz var för
 * sig), rättning och avslöjande, klart.
 */
export type Stage = 'lobby' | 'evening' | 'wrapup' | 'done'

/** Quizets läge: inget, låten spelar (inga svar), frågan är öppen (tiden går), frågan är stängd. */
export type QuizState = 'idle' | 'playing' | 'open' | 'closed'

/** Stegen i rättning och avslöjande, `live/wrapup/step`. */
export type WrapupStep = 'review' | 'guess' | 'reveal'

/** Svarsalternativ i en quizfråga. */
export type Choice = 'A' | 'B' | 'C' | 'D'

/** Tidpunkt i millisekunder enligt serverns klocka (`ServerValue.TIMESTAMP`). */
export type ServerTime = number

/** När en fråga öppnades och hur länge den var öppen, i serverns tid. */
export type QuestionTiming = {
  /** `ServerValue.TIMESTAMP` */
  openedAt: ServerTime
  durationMs: number
}

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
  /** Visas i kontrollpanelen och i reservläget (”Starta låt 2 – Last Christmas från 0:45”). */
  title?: string
  artist?: string
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
  /** qId → när frågan öppnades. Skrivs i samma anrop som `live/quiz`, så att stjärnorna kan räknas i efterhand. */
  quizTimes?: Record<string, QuestionTiming>
  /** Hela topplistan före avslöjandet. */
  leaderboard?: Record<string, LeaderboardEntry>
}

// ── live/: admin skriver, alla läser ────────────────────────────────────────

/** Provningen i en klass, oberoende av quizet. */
export type TastingState = {
  /** Gästerna i klassen får ranka. */
  open: boolean
  serving: number | null
  next: number | null
}

/**
 * Quizet, oberoende av provningen. `openedAt` och `durationMs` sätts bara när
 * frågan visas (`state: "open"`), med samma tider i `secret/quizTimes/{qId}`.
 */
export type LiveQuiz = Partial<QuestionTiming> & {
  state: QuizState
  songId?: string
  qId?: string
}

export type LiveWrapup = {
  step: WrapupStep
  /** Frågan som gås igenom i rättningen. */
  qId?: string
  /** 0–4: vid steg 1–4 avslöjas 4:an, 3:an, 2:an och vinnaren. */
  revealStep?: 0 | 1 | 2 | 3 | 4
}

export type LiveState = {
  stage: Stage
  tasting?: Partial<Record<GuestClass, TastingState>>
  quiz?: LiveQuiz
  wrapup?: LiveWrapup
  /** Hur många som har svarat på frågan som visas. Admin skriver det, eftersom gäster inte får läsa andras svar. */
  answered?: AnsweredCount
}

export type AnsweredCount = { qId: string; count: number; total: number }

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
  /** Gästens namn, så att mobilerna kan visa topplistan utan att läsa guests/. */
  name: string
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

/** Gästens egna anteckningar per glögg, notes/{uid}: nummer → fritext (#98). */
export type GuestNotes = Record<GloggNumber, string>

/** Längsta tillåtna anteckning, samma gräns som i databasreglerna. */
export const NOTE_MAX_LENGTH = 500
