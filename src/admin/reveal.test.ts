import { describe, expect, it } from 'vitest'
import type { ScoreRow } from '../scoring'
import { rowForStep, startChanges, stepChanges, stepLabel, visibleRows } from './reveal'

const row = (uid: string, rank: number, points: number): ScoreRow => ({ uid, name: uid.toUpperCase(), points, stars: 0, rank })
const rows = [row('a', 1, 9), row('b', 2, 8), row('c', 3, 7), row('d', 4, 6), row('e', 5, 5), row('f', 6, 4)]
const glogg = { vanlig: { gId: 'g1', avg: 4.5 } }

describe('avslöjandet', () => {
  it('steg 0: hela listan i secret/, men bara plats 5 och nedåt i results/', () => {
    const changes = startChanges(rows)
    expect(Object.keys(changes['secret/leaderboard'] as object)).toEqual(['a', 'b', 'c', 'd', 'e', 'f'])
    expect(changes['results/leaderboard']).toEqual({
      e: { points: 5, stars: 0, rank: 5, name: 'E' },
      f: { points: 4, stars: 0, rank: 6, name: 'F' },
    })
    expect(changes['live/wrapup/revealStep']).toEqual(0)
    // Topp 4 och Kvällens glögg finns inte där gästerna kan läsa.
    expect(JSON.stringify(changes['results/leaderboard'])).not.toMatch(/"[ABCD]"/)
    expect(changes['results/gloggOfEvening']).toBeNull()
  })

  it('steg 1–4 lägger till 4:an, 3:an, 2:an och vinnaren, en rad per steg', () => {
    expect([1, 2, 3, 4].map((s) => rowForStep(rows, s as 1 | 2 | 3 | 4)?.uid)).toEqual(['d', 'c', 'b', 'a'])
    expect(stepChanges(rows, 1, glogg)).toEqual({
      'live/wrapup/revealStep': 1,
      'results/leaderboard/d': { points: 6, stars: 0, rank: 4, name: 'D' },
    })
  })

  it('Kvällens glögg skrivs först med vinnaren', () => {
    expect(stepChanges(rows, 3, glogg)).not.toHaveProperty('results/gloggOfEvening')
    expect(stepChanges(rows, 4, glogg)).toMatchObject({
      'results/leaderboard/a': { rank: 1 },
      'results/gloggOfEvening': glogg,
    })
  })

  it('klarar färre än fyra gäster', () => {
    const two = rows.slice(0, 2)
    expect(startChanges(two)['results/leaderboard']).toEqual({})
    expect(stepChanges(two, 1, glogg)).toEqual({ 'live/wrapup/revealStep': 1 })
    expect(stepChanges(two, 4, glogg)).toHaveProperty('results/leaderboard/a')
  })

  it('visibleRows och stepLabel', () => {
    expect(visibleRows(rows, null)).toEqual([])
    expect(visibleRows(rows, 0).map((r) => r.uid)).toEqual(['e', 'f'])
    expect(visibleRows(rows, 2).map((r) => r.uid)).toEqual(['c', 'd', 'e', 'f'])
    expect([1, 2, 3, 4].map((s) => stepLabel(s as 1 | 2 | 3 | 4))).toEqual([
      'Avslöja 4:an',
      'Avslöja 3:an',
      'Avslöja 2:an',
      'Avslöja vinnaren',
    ])
  })
})
