// Avslöjandet av topplistan, steg 0–4. Rena funktioner utan Firebase.
//
// Steg 0 skriver hela listan till secret/leaderboard och bara plats 5 och nedåt
// till results/leaderboard. Steg 1–4 lägger till 4:an, 3:an, 2:an och vinnaren,
// en rad per steg. Topp 4 finns alltså inte där gästerna kan läsa innan de avslöjas.
import { toLeaderboard, type ScoreRow } from '../scoring'
import type { GloggOfEvening, GuestClass, LeaderboardEntry } from '../types'

export const TOP = 4
export type RevealStep = 0 | 1 | 2 | 3 | 4

/** Raden som avslöjas i ett steg: steg 1 är 4:an (index 3), steg 4 är vinnaren (index 0). */
export function rowForStep(rows: readonly ScoreRow[], step: RevealStep): ScoreRow | undefined {
  return step === 0 ? undefined : rows[TOP - step]
}

/** Raderna som gästerna får se efter ett steg. */
export function visibleRows(rows: readonly ScoreRow[], step: RevealStep | null): ScoreRow[] {
  if (step === null) return []
  return rows.filter((_, i) => i >= TOP || i >= TOP - step)
}

const entry = (row: ScoreRow): LeaderboardEntry => ({ points: row.points, stars: row.stars, rank: row.rank, name: row.name })

/** Skrivningarna för steg 0: hela listan i secret/, plats 5 och nedåt i results/. */
export function startChanges(rows: readonly ScoreRow[]): Record<string, unknown> {
  return {
    'secret/leaderboard': toLeaderboard([...rows]),
    'results/leaderboard': toLeaderboard(rows.slice(TOP)),
    'results/gloggOfEvening': null,
    'live/reveal': { step: 0 },
  }
}

/**
 * Skrivningarna för steg 1–4: en rad till i results/leaderboard. I sista
 * steget skrivs också Kvällens glögg.
 */
export function stepChanges(
  rows: readonly ScoreRow[],
  step: Exclude<RevealStep, 0>,
  gloggOfEvening: Partial<Record<GuestClass, GloggOfEvening>>,
): Record<string, unknown> {
  const changes: Record<string, unknown> = { 'live/reveal': { step } }
  const row = rowForStep(rows, step)
  if (row) changes[`results/leaderboard/${row.uid}`] = entry(row)
  if (step === TOP) changes['results/gloggOfEvening'] = gloggOfEvening
  return changes
}

/** Knappen för nästa steg: ”Avslöja 4:an” … ”Avslöja vinnaren”. */
export function stepLabel(step: Exclude<RevealStep, 0>): string {
  return step === TOP ? 'Avslöja vinnaren' : `Avslöja ${TOP + 1 - step}:an`
}
