// Alla beräkningar: poäng, stjärnor, topplista och Kvällens glögg.
// Rena funktioner utan Firebase-beroenden, så att de kan enhetstestas.
import type {
  Answer,
  Choice,
  Criterion,
  GloggNumber,
  GloggOfEvening,
  Guest,
  GuestClass,
  GuestRatings,
  LeaderboardEntry,
} from './types'

/** När en fråga öppnades och hur länge den var öppen, i serverns tid. */
export type QuestionTiming = {
  openedAt: number
  durationMs: number
}

/** qId → tidpunkt och längd för frågan. Admin-enheten sparar `live/quiz` för varje fråga den öppnar. */
export type QuizConfig = Record<string, QuestionTiming>

/** En rad i topplistan, sorterad. */
export type ScoreRow = LeaderboardEntry & {
  uid: string
  name: string
}

/**
 * Stjärnor för ett rätt svar, efter hur stor del av tiden som var kvar:
 * > 0,75 → 3, > 0,50 → 2, > 0,25 → 1, annars 0.
 * Räknas i heltal (kvar · 4 jämfört med durationMs · n) så att gränserna blir exakta.
 */
export function starsFor(at: number, timing: QuestionTiming): number {
  const { openedAt, durationMs } = timing
  if (!(durationMs > 0)) return 0
  const remaining4 = (openedAt + durationMs - at) * 4
  if (remaining4 > durationMs * 3) return 3
  if (remaining4 > durationMs * 2) return 2
  if (remaining4 > durationMs) return 1
  return 0
}

const byName = new Intl.Collator('sv').compare

/**
 * Räknar poäng och stjärnor för alla gäster och sorterar topplistan.
 *
 * - 1 poäng per rätt svar; stjärnor bara för rätt svar.
 * - Sortering: poäng, stjärnor, namn. Lika poäng och lika stjärnor ger delad
 *   placering (1, 1, 3, …).
 * - Alla i `guests` kommer med, även de som inte svarat. Den som svarat utan
 *   att finnas bland gästerna (t.ex. borttagen dubblett) räknas inte.
 * - Frågor utan facit eller utan tidpunkt hoppas över.
 */
export function score(
  answers: Record<string, Record<string, Answer>> | undefined,
  correct: Record<string, Choice> | undefined,
  quizConfig: QuizConfig,
  guests: Record<string, Pick<Guest, 'name'>> | undefined,
): ScoreRow[] {
  const totals = new Map<string, { points: number; stars: number }>()
  for (const uid of Object.keys(guests ?? {})) totals.set(uid, { points: 0, stars: 0 })

  for (const [qId, byUid] of Object.entries(answers ?? {})) {
    const right = correct?.[qId]
    const timing = quizConfig[qId]
    if (!right || !timing) continue
    for (const [uid, answer] of Object.entries(byUid ?? {})) {
      const total = totals.get(uid)
      if (!total || answer?.choice !== right) continue
      total.points += 1
      total.stars += starsFor(answer.at, timing)
    }
  }

  const rows = [...totals].map(([uid, t]) => ({ uid, name: guests?.[uid]?.name ?? '', ...t, rank: 0 }))
  rows.sort((a, b) => b.points - a.points || b.stars - a.stars || byName(a.name, b.name) || (a.uid < b.uid ? -1 : 1))
  rows.forEach((row, i) => {
    const prev = rows[i - 1]
    row.rank = prev && prev.points === row.points && prev.stars === row.stars ? prev.rank : i + 1
  })
  return rows
}

/** Topplistan i formen som skrivs till `results/leaderboard` och `secret/leaderboard`. */
export function toLeaderboard(rows: ScoreRow[]): Record<string, LeaderboardEntry> {
  return Object.fromEntries(rows.map(({ uid, points, stars, rank }) => [uid, { points, stars, rank }]))
}

/**
 * Kvällens glögg per klass: snittet av alla betyg på alla kriterier, där
 * kriterier med `lowIsGood` räknas som 6 − värdet. Högst snitt vinner.
 *
 * Ett betyg räknas i gästens nuvarande klass. Betyg på kriterier som inte
 * finns, nummer utan glögg och värden utanför 1–5 räknas inte. Vid lika snitt
 * vinner lägst gId, så resultatet blir detsamma varje gång. En klass utan
 * betyg saknas i svaret.
 */
export function gloggOfEvening(
  ratings: Record<string, GuestRatings> | undefined,
  guests: Record<string, Pick<Guest, 'class'>> | undefined,
  criteria: Record<string, Pick<Criterion, 'lowIsGood'>> | undefined,
  numbers: Partial<Record<GuestClass, Record<GloggNumber, string>>> | undefined,
): Partial<Record<GuestClass, GloggOfEvening>> {
  const sums = new Map<GuestClass, Map<string, { sum: number; count: number }>>()

  for (const [uid, byNumber] of Object.entries(ratings ?? {})) {
    const cls = guests?.[uid]?.class
    if (!cls) continue
    for (const [number, byCriterion] of Object.entries(byNumber ?? {})) {
      const gId = numbers?.[cls]?.[number]
      if (!gId) continue
      for (const [cId, value] of Object.entries(byCriterion ?? {})) {
        const criterion = criteria?.[cId]
        if (!criterion || !Number.isInteger(value) || value < 1 || value > 5) continue
        const perGlogg = sums.get(cls) ?? new Map()
        sums.set(cls, perGlogg)
        const s = perGlogg.get(gId) ?? { sum: 0, count: 0 }
        s.sum += criterion.lowIsGood ? 6 - value : value
        s.count += 1
        perGlogg.set(gId, s)
      }
    }
  }

  const result: Partial<Record<GuestClass, GloggOfEvening>> = {}
  for (const [cls, perGlogg] of sums) {
    let best: GloggOfEvening | undefined
    for (const [gId, { sum, count }] of perGlogg) {
      const avg = sum / count
      if (!best || avg > best.avg || (avg === best.avg && gId < best.gId)) best = { gId, avg }
    }
    if (best) result[cls] = best
  }
  return result
}
