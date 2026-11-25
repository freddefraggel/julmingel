import { describe, expect, it } from 'vitest'
import type { EventConfig, Guest } from '../types'
import { answerStats, nextSong, positionLabel, quizControl, quizPlan, secondsLeft } from './quiz'

const TRACK = 'spotify:track:2FRnf9qhLbvw8fu4IBXx78'
const options = { A: 'a', B: 'b', C: 'c', D: 'd' }

const quizConfig: EventConfig = {
  name: 'Test',
  joinOpen: true,
  songs: {
    s2: { order: 2, spotifyUri: TRACK, title: 'Last Christmas', startMs: 0, secondsPerQuestion: 20 },
    s1: { order: 1, spotifyUri: TRACK, startMs: 30_000, secondsPerQuestion: 30 },
  },
  questions: {
    q3: { songId: 's2', order: 3, text: 'Artist?', answerType: 'text', options },
    q1: { songId: 's1', order: 1, text: 'Årtal?', answerType: 'text', options },
    q2: { songId: 's1', order: 2, text: 'Film?', answerType: 'text', options },
    qx: { songId: 'borta', order: 4, text: 'Hoppas över', answerType: 'text', options },
  },
}

describe('quizPlan', () => {
  const plan = quizPlan(quizConfig)

  it('ordnar frågorna efter låtarna och inom låten', () => {
    expect(plan.map((p) => [p.qId, p.cue.number, p.inSong, p.songCount, p.overall, p.startsSong, p.durationMs])).toEqual([
      ['q1', 1, 1, 2, 1, true, 30_000],
      ['q2', 1, 2, 2, 2, false, 30_000],
      ['q3', 2, 1, 1, 3, true, 20_000],
    ])
    expect(positionLabel(plan[1]!)).toBe('Låt 1 · fråga 2 av 2')
  })

  it('tom utan låtar', () => {
    expect(quizPlan(null)).toEqual([])
  })
})

describe('answerStats', () => {
  const guests: Record<string, Guest> = {
    u1: { name: 'Örjan', class: 'vanlig', joinCode: 'k', joinedAt: 1 },
    u2: { name: 'Anna', class: 'vanlig', joinCode: 'k', joinedAt: 1 },
    u3: { name: 'Åsa', class: 'alkfri', joinCode: 'k', joinedAt: 1 },
    u4: { name: 'Bo', class: 'alkfri', joinCode: 'k', joinedAt: 1 },
  }

  it('räknar svaren per alternativ och listar dem som inte har svarat', () => {
    const stats = answerStats({ u1: { choice: 'B', at: 1 }, u4: { choice: 'B', at: 2 }, borta: { choice: 'A', at: 3 } }, guests)
    expect(stats).toEqual({ counts: { A: 0, B: 2, C: 0, D: 0 }, answered: 2, waiting: ['Anna', 'Åsa'] })
  })

  it('klarar att inget har kommit än', () => {
    expect(answerStats(undefined, null)).toEqual({ counts: { A: 0, B: 0, C: 0, D: 0 }, answered: 0, waiting: [] })
  })
})

describe('secondsLeft', () => {
  it('räknar hela sekunder uppåt och aldrig under noll', () => {
    expect(secondsLeft(1000, 30_000, 1000)).toBe(30)
    expect(secondsLeft(1000, 30_000, 1001)).toBe(30)
    expect(secondsLeft(1000, 30_000, 30_500)).toBe(1)
    expect(secondsLeft(1000, 30_000, 31_000)).toBe(0)
    expect(secondsLeft(1000, 30_000, 99_000)).toBe(0)
  })
})

describe('quizControl: huvudknappen följer läget', () => {
  const plan = quizPlan(quizConfig)
  const control = (quiz: { state: string; qId?: string } | null, left: number | null = null) => quizControl(plan, quiz, left)

  it('idle utan qId: Spela låt 1, med Hoppa över låten', () => {
    const c = control({ state: 'idle' })
    expect(c.primary).toMatchObject({ kind: 'play', label: 'Spela låt 1' })
    expect(c.primary.kind === 'play' && c.primary.target.qId).toBe('q1')
    expect(c.side).toEqual({ kind: 'skip', label: 'Hoppa över låten' })
    expect(control(null).primary.label).toBe('Spela låt 1')
  })

  it('playing: Visa fråga N, med Pausa låten', () => {
    const c = control({ state: 'playing', qId: 'q1' })
    expect(c.primary).toMatchObject({ kind: 'open', label: 'Visa fråga 1' })
    expect(c.side?.label).toBe('Pausa låten')
    expect(c.later).toBe('Sedan: fråga 2 – Film?')
  })

  it('open: avstängd med sekunderna kvar, och Stäng frågan nu', () => {
    const c = control({ state: 'open', qId: 'q2' }, 18)
    expect(c.primary).toEqual({ kind: 'wait', label: 'Fråga 2 är öppen · 18 s kvar' })
    expect(c.side?.kind).toBe('close')
  })

  it('closed: samma låt, ny låt, eller klart', () => {
    expect(control({ state: 'closed', qId: 'q1' }).primary).toMatchObject({ kind: 'open', label: 'Visa fråga 2 · samma låt' })
    expect(control({ state: 'closed', qId: 'q2' }).primary).toMatchObject({ kind: 'play', label: 'Spela låt 2' })
    const last = control({ state: 'closed', qId: 'q3' })
    expect(last.primary).toEqual({ kind: 'wait', label: 'Alla frågor klara – starta rättningen när ni vill' })
    expect(last.side).toBeNull()
  })

  it('idle med qId fortsätter där quizet stannade; sista låten går inte att hoppa över', () => {
    const c = control({ state: 'idle', qId: 'q3' })
    expect(c.primary).toMatchObject({ kind: 'play', label: 'Spela låt 2' })
    expect(c.side).toBeNull()
    expect(c.later).toBe('Sista frågan')
  })

  it('nextSong ger första frågan på nästa låt', () => {
    expect(nextSong(plan, plan[0]!)?.qId).toBe('q3')
    expect(nextSong(plan, plan[2]!)).toBeNull()
  })
})
