import { describe, expect, it } from 'vitest'
import type { EventConfig, Guest, GuestRatings } from '../types'
import { guestsInClass, numberAfter, ratedCount, serve, tabLabel, tastingRows } from './tasting'

const gloggs: EventConfig['gloggs'] = {
  ga: { class: 'vanlig', name: 'Röd', description: 'Kanel', imageId: 'i1' },
  gb: { class: 'vanlig', name: 'Vit', description: '' },
  gc: { class: 'vanlig', name: '', description: '' },
}
const numbers = { '2': 'gb', '1': 'ga', '3': 'gc' }

describe('tastingRows', () => {
  it('ger serveringsordningen med status', () => {
    const rows = tastingRows(numbers, gloggs, { serving: 2, next: 3 })
    expect(rows.map((r) => [r.number, r.gId, r.name, r.status])).toEqual([
      [1, 'ga', 'Röd', 'done'],
      [2, 'gb', 'Vit', 'now'],
      [3, 'gc', 'Glögg 3', 'next'],
    ])
    expect(rows[0]).toMatchObject({ description: 'Kanel', imageId: 'i1' })
  })

  it('allt väntar innan något har serverats', () => {
    expect(tastingRows(numbers, gloggs, undefined).map((r) => r.status)).toEqual(['wait', 'wait', 'wait'])
    expect(tastingRows(numbers, gloggs, { serving: null, next: 1 }).map((r) => r.status)).toEqual(['next', 'wait', 'wait'])
  })

  it('klarar att admin hoppar över ett nummer', () => {
    expect(tastingRows(numbers, gloggs, { serving: 3, next: 1 }).map((r) => r.status)).toEqual(['next', 'done', 'now'])
  })

  it('tom när klassen saknar nummer', () => {
    expect(tastingRows(undefined, gloggs, undefined)).toEqual([])
  })
})

describe('serve och numberAfter', () => {
  const rows = tastingRows({ '1': 'ga', '2': 'gb', '4': 'gc' }, gloggs, undefined)

  it('nästa nummer i ordningen, även med luckor', () => {
    expect(numberAfter(rows, null)).toBe(1)
    expect(numberAfter(rows, 2)).toBe(4)
    expect(numberAfter(rows, 4)).toBeNull()
  })

  it('serverar ett nummer och förbereder nästa', () => {
    expect(serve(rows, 1)).toEqual({ serving: 1, next: 2 })
    expect(serve(rows, 4)).toEqual({ serving: 4, next: null })
  })
})

describe('gäster och betyg', () => {
  const guests: Record<string, Guest> = {
    u1: { name: 'Anna', class: 'vanlig', joinCode: 'k', joinedAt: 1 },
    u2: { name: 'Bo', class: 'vanlig', joinCode: 'k', joinedAt: 2 },
    u3: { name: 'Cia', class: 'alkfri', joinCode: 'k', joinedAt: 3 },
  }

  it('gäster per klass', () => {
    expect(guestsInClass(guests, 'vanlig')).toEqual(['u1', 'u2'])
    expect(guestsInClass(null, 'alkfri')).toEqual([])
  })

  it('räknar klassens gäster med minst ett betyg på numret', () => {
    const ratings: Record<string, GuestRatings> = { u1: { '2': { c1: 4 } }, u2: { '1': { c1: 3 }, '2': {} }, u3: { '2': { c1: 5 } } }
    expect(ratedCount(ratings, ['u1', 'u2'], 2)).toBe(1)
    expect(ratedCount(ratings, ['u1', 'u2'], 1)).toBe(1)
    expect(ratedCount(undefined, ['u1'], 1)).toBe(0)
  })
})

describe('tabLabel', () => {
  const rows = tastingRows(numbers, gloggs, undefined)
  it('visar nummer av antal och antal gäster', () => {
    expect(tabLabel('Vanlig', rows, 2, 14)).toBe('Vanlig · nr 2 av 3 · 14 gäster')
    expect(tabLabel('Alkoholfri', rows, null, 1)).toBe('Alkoholfri · 3 glögger · 1 gäst')
    expect(tabLabel('Alkoholfri', rows.slice(0, 1), null, 0)).toBe('Alkoholfri · 1 glögg · 0 gäster')
  })
})
