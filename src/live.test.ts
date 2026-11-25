import { describe, expect, it } from 'vitest'
import { phaseChanges, phaseOf, quizTiming } from './live'

describe('phaseOf', () => {
  it('härleder den gamla fasen från de tre lägena', () => {
    expect(phaseOf(null)).toBeUndefined()
    expect(phaseOf({ stage: 'lobby' })).toBe('registration')
    expect(phaseOf({ stage: 'evening' })).toBe('tasting')
    expect(phaseOf({ stage: 'evening', tasting: { vanlig: { open: true, serving: 1, next: 2 } } })).toBe('tasting')
    expect(phaseOf({ stage: 'evening', quiz: { state: 'idle' } })).toBe('quiz')
    expect(phaseOf({ stage: 'wrapup', wrapup: { step: 'guess' } })).toBe('guess')
    expect(phaseOf({ stage: 'wrapup' })).toBe('review')
    expect(phaseOf({ stage: 'done' })).toBe('done')
  })
})

describe('phaseChanges', () => {
  it('provningen öppnar båda klasserna och tar bort quizet', () => {
    expect(phaseChanges('tasting')).toEqual({
      'live/stage': 'evening',
      'live/tasting/vanlig/open': true,
      'live/tasting/alkfri/open': true,
      'live/quiz': null,
    })
  })

  it('quizet stänger provningen men behåller kvällens läge', () => {
    expect(phaseChanges('quiz')).toEqual({
      'live/stage': 'evening',
      'live/tasting/vanlig/open': false,
      'live/tasting/alkfri/open': false,
      'live/quiz/state': 'idle',
    })
  })

  it('rättning, gissning och avslöjande är steg i avslutningen', () => {
    expect(phaseChanges('guess')).toMatchObject({ 'live/stage': 'wrapup', 'live/wrapup/step': 'guess', 'live/quiz': null })
    expect(phaseChanges('registration')).toMatchObject({ 'live/stage': 'lobby' })
    expect(phaseChanges('done')).toMatchObject({ 'live/stage': 'done' })
  })

  it('varje fas i listan ger tillbaka samma fas', () => {
    for (const phase of ['registration', 'tasting', 'quiz', 'review', 'guess', 'reveal', 'done'] as const) {
      const live: Record<string, unknown> = {}
      for (const [path, value] of Object.entries(phaseChanges(phase))) {
        const keys = path.replace(/^live\//, '').split('/')
        let node = live
        keys.slice(0, -1).forEach((k) => (node = (node[k] ??= {}) as Record<string, unknown>))
        if (value !== null) node[keys[keys.length - 1]!] = value
      }
      expect(phaseOf(live as never)).toBe(phase)
    }
  })
})

describe('quizTiming', () => {
  it('ger tiderna bara när frågan har visats', () => {
    expect(quizTiming({ stage: 'evening', quiz: { state: 'playing', songId: 's1', qId: 'q1' } })).toBeNull()
    expect(quizTiming({ stage: 'evening', quiz: { state: 'open', qId: 'q1', openedAt: 5, durationMs: 20 } })).toEqual({
      openedAt: 5,
      durationMs: 20,
    })
    expect(quizTiming(null)).toBeNull()
  })
})
