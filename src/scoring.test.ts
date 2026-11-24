import { describe, expect, it } from 'vitest'
import type { Answer, Choice, GuestRatings } from './types'
import { gloggOfEvening, score, starsFor, toLeaderboard, type QuizConfig } from './scoring'

const timing = { openedAt: 1_000_000, durationMs: 20_000 }
/** Svar när `left` av tiden är kvar (0–1). */
const atLeft = (left: number) => timing.openedAt + timing.durationMs * (1 - left)

describe('starsFor', () => {
  it.each([
    [1, 3],
    [0.76, 3],
    [0.75, 2], // exakt gräns: > 0,75 krävs för 3
    [0.51, 2],
    [0.5, 1],
    [0.26, 1],
    [0.25, 0],
    [0, 0],
  ])('kvar %s ger %s stjärnor', (left, stars) => {
    expect(starsFor(atLeft(left), timing)).toBe(stars)
  })

  it('en millisekund över gränsen räcker', () => {
    expect(starsFor(atLeft(0.75) - 1, timing)).toBe(3)
    expect(starsFor(atLeft(0.25) - 1, timing)).toBe(1)
  })

  it('gränser blir exakta även när durationMs inte delas jämnt', () => {
    const t = { openedAt: 0, durationMs: 7 }
    // 5/7 ≈ 0,714 och 6/7 ≈ 0,857 ligger på var sin sida om 0,75
    expect(starsFor(2, t)).toBe(2) // kvar 5/7
    expect(starsFor(1, t)).toBe(3) // kvar 6/7
  })

  it('svar efter sluttiden eller utan längd ger 0', () => {
    expect(starsFor(atLeft(-0.1), timing)).toBe(0)
    expect(starsFor(0, { openedAt: 0, durationMs: 0 })).toBe(0)
  })
})

describe('score', () => {
  const quiz: QuizConfig = { q1: timing, q2: timing }
  const correct: Record<string, Choice> = { q1: 'A', q2: 'B' }
  const ans = (choice: Choice, left: number): Answer => ({ choice, at: atLeft(left) })

  it('1 poäng per rätt svar och stjärnor bara för rätt svar', () => {
    const rows = score(
      {
        q1: { u1: ans('A', 0.9), u2: ans('C', 0.9) },
        q2: { u1: ans('B', 0.6), u2: ans('B', 0.1) },
      },
      correct,
      quiz,
      { u1: { name: 'Anna' }, u2: { name: 'Bo' } },
    )
    expect(rows).toEqual([
      { uid: 'u1', name: 'Anna', points: 2, stars: 5, rank: 1 },
      { uid: 'u2', name: 'Bo', points: 1, stars: 0, rank: 2 },
    ])
  })

  it('sorterar på poäng, sedan stjärnor, sedan namn', () => {
    const rows = score(
      {
        q1: { a: ans('A', 0.3), b: ans('A', 0.9), c: ans('A', 0.3), d: ans('A', 0.3) },
        q2: { d: ans('B', 0.1) },
      },
      correct,
      quiz,
      { a: { name: 'Örjan' }, b: { name: 'Zara' }, c: { name: 'Åsa' }, d: { name: 'Ylva' } },
    )
    // d: 2 p; b: 1 p 3★; Åsa före Örjan i svensk ordning, båda 1 p 1★
    expect(rows.map((r) => [r.name, r.rank])).toEqual([
      ['Ylva', 1],
      ['Zara', 2],
      ['Åsa', 3],
      ['Örjan', 3],
    ])
  })

  it('lika poäng och stjärnor ger delad placering, nästa hoppar över', () => {
    const rows = score(
      { q1: { a: ans('A', 0.9), b: ans('A', 0.9), c: ans('A', 0.6) } },
      correct,
      quiz,
      { a: { name: 'Bo' }, b: { name: 'Anna' }, c: { name: 'Cia' }, d: { name: 'Dan' } },
    )
    expect(rows.map((r) => [r.name, r.rank])).toEqual([
      ['Anna', 1],
      ['Bo', 1],
      ['Cia', 3],
      ['Dan', 4],
    ])
  })

  it('lika poäng men olika stjärnor ger olika placering', () => {
    const rows = score(
      { q1: { a: ans('A', 0.9), b: ans('A', 0.1) } },
      correct,
      quiz,
      { a: { name: 'Bo' }, b: { name: 'Anna' } },
    )
    expect(rows.map((r) => [r.name, r.rank])).toEqual([
      ['Bo', 1],
      ['Anna', 2],
    ])
  })

  it('tar med gäster utan svar och hoppar över okända uid', () => {
    const rows = score({ q1: { ghost: ans('A', 1) } }, correct, quiz, { a: { name: 'Anna' } })
    expect(rows).toEqual([{ uid: 'a', name: 'Anna', points: 0, stars: 0, rank: 1 }])
  })

  it('hoppar över frågor utan facit eller tidpunkt', () => {
    const rows = score(
      { q1: { a: ans('A', 1) }, q2: { a: ans('B', 1) }, q3: { a: ans('C', 1) } },
      { q1: 'A', q3: 'C' },
      { q1: timing, q2: timing },
      { a: { name: 'Anna' } },
    )
    expect(rows[0]).toMatchObject({ points: 1, stars: 3 })
  })

  it('klarar tomma indata', () => {
    expect(score(undefined, undefined, {}, undefined)).toEqual([])
    expect(score(undefined, correct, quiz, { a: { name: 'Anna' } })).toEqual([
      { uid: 'a', name: 'Anna', points: 0, stars: 0, rank: 1 },
    ])
  })

  it('toLeaderboard ger formen för results/leaderboard', () => {
    const rows = score({ q1: { a: ans('A', 1) } }, correct, quiz, { a: { name: 'Anna' }, b: { name: 'Bo' } })
    expect(toLeaderboard(rows)).toEqual({
      a: { points: 1, stars: 3, rank: 1 },
      b: { points: 0, stars: 0, rank: 2 },
    })
  })
})

describe('gloggOfEvening', () => {
  const criteria = { smak: { lowIsGood: false }, sotma: { lowIsGood: true } }
  const numbers = {
    vanlig: { '1': 'gA', '2': 'gB' },
    alkfri: { '1': 'gC', '2': 'gD' },
  }
  const guests = { u1: { class: 'vanlig' as const }, u2: { class: 'vanlig' as const }, u3: { class: 'alkfri' as const } }

  it('snitt av alla betyg per klass, lowIsGood räknas som 6 − värdet', () => {
    const ratings: Record<string, GuestRatings> = {
      // gA: smak 4, 2; sötma 1 → 5, 5 → 1  ⇒ (4+2+5+1)/4 = 3
      // gB: smak 3, 5; sötma 2 → 4, 2 → 4  ⇒ (3+5+4+4)/4 = 4
      u1: { '1': { smak: 4, sotma: 1 }, '2': { smak: 3, sotma: 2 } },
      u2: { '1': { smak: 2, sotma: 5 }, '2': { smak: 5, sotma: 2 } },
      // alkfri: gC 5 och 6−1=5 ⇒ 5; gD 1 ⇒ 1
      u3: { '1': { smak: 5, sotma: 1 }, '2': { smak: 1 } },
    }
    expect(gloggOfEvening(ratings, guests, criteria, numbers)).toEqual({
      vanlig: { gId: 'gB', avg: 4 },
      alkfri: { gId: 'gC', avg: 5 },
    })
  })

  it('väger varje betyg lika, inte varje gäst', () => {
    const ratings: Record<string, GuestRatings> = {
      u1: { '1': { smak: 5, sotma: 1 } }, // gA: 5, 5
      u2: { '1': { smak: 1 }, '2': { smak: 4 } }, // gA: 1; gB: 4
    }
    // gA: (5+5+1)/3 = 3,67 (snitt av gästsnitt hade varit 3)
    expect(gloggOfEvening(ratings, guests, criteria, numbers).vanlig).toEqual({ gId: 'gB', avg: 4 })
    const tight: Record<string, GuestRatings> = { ...ratings, u2: { '1': { smak: 1 }, '2': { smak: 3 } } }
    expect(gloggOfEvening(tight, guests, criteria, numbers).vanlig).toEqual({ gId: 'gA', avg: 11 / 3 })
  })

  it('räknar betyg i gästens nuvarande klass', () => {
    // u3 är alkfri: nummer 2 är gD där, inte gB
    expect(gloggOfEvening({ u3: { '2': { smak: 4 } } }, guests, criteria, numbers)).toEqual({
      alkfri: { gId: 'gD', avg: 4 },
    })
  })

  it('hoppar över okända gäster, nummer, kriterier och ogiltiga värden', () => {
    const ratings = {
      ghost: { '1': { smak: 5 } },
      u1: { '9': { smak: 5 }, '1': { okänd: 5, smak: 0, sotma: 7 }, '2': { smak: 2 } },
    } as unknown as Record<string, GuestRatings>
    expect(gloggOfEvening(ratings, guests, criteria, numbers)).toEqual({ vanlig: { gId: 'gB', avg: 2 } })
  })

  it('lika snitt avgörs av lägst gId', () => {
    const ratings: Record<string, GuestRatings> = { u1: { '2': { smak: 3 }, '1': { smak: 3 } } }
    expect(gloggOfEvening(ratings, guests, criteria, numbers).vanlig).toEqual({ gId: 'gA', avg: 3 })
  })

  it('klass utan betyg saknas, tomma indata ger tomt svar', () => {
    expect(gloggOfEvening({ u1: { '1': { smak: 3 } } }, guests, criteria, numbers)).not.toHaveProperty('alkfri')
    expect(gloggOfEvening(undefined, undefined, undefined, undefined)).toEqual({})
  })
})
