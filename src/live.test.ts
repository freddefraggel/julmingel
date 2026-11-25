import { describe, expect, it } from 'vitest'
import { quizTiming, stageChanges, stageIndex, wrapupStepChanges } from './live'

describe('stageChanges', () => {
  it('innan start och kvällen pågår skriver bara läget', () => {
    expect(stageChanges('lobby', null)).toEqual({ 'live/stage': 'lobby' })
    expect(stageChanges('evening', { stage: 'lobby' })).toEqual({ 'live/stage': 'evening' })
    expect(stageChanges('done', { stage: 'wrapup' })).toEqual({ 'live/stage': 'done' })
  })

  it('rättning och avslöjande stänger provningen och en låt eller fråga som pågår', () => {
    expect(stageChanges('wrapup', { stage: 'evening', quiz: { state: 'open', qId: 'q1', openedAt: 1, durationMs: 2 } })).toEqual({
      'live/stage': 'wrapup',
      'live/wrapup/step': 'review',
      'live/tasting/vanlig/open': false,
      'live/tasting/alkfri/open': false,
      'live/quiz/state': 'closed',
    })
    expect(stageChanges('wrapup', { stage: 'evening', quiz: { state: 'closed', qId: 'q1' } })).not.toHaveProperty('live/quiz/state')
  })

  it('behåller steget om admin går tillbaka till avslutningen', () => {
    expect(stageChanges('wrapup', { stage: 'evening', wrapup: { step: 'reveal' } })).toMatchObject({ 'live/wrapup/step': 'reveal' })
  })
})

describe('wrapupStepChanges och stageIndex', () => {
  it('ett steg sätter också läget, och Klart sätter done', () => {
    expect(wrapupStepChanges('guess')).toEqual({ 'live/stage': 'wrapup', 'live/wrapup/step': 'guess' })
    expect(wrapupStepChanges('done')).toEqual({ 'live/stage': 'done' })
  })

  it('stageIndex: klart räknas som avslutningen', () => {
    expect([undefined, 'lobby', 'evening', 'wrapup', 'done'].map((s) => stageIndex(s as never))).toEqual([-1, 0, 1, 2, 2])
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
