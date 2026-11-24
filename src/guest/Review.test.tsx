import { act, cleanup, render, screen, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import * as data from '../data'
import type { Answer, EventConfig, EventReveal } from '../types'
import { pointsSoFar, Review } from './Review'

vi.mock('../data', () => ({
  subscribeReveal: vi.fn(),
  subscribeOwnAnswer: vi.fn(),
}))

const mocked = vi.mocked(data)
const TRACK = 'spotify:track:2FRnf9qhLbvw8fu4IBXx78'

const config: EventConfig = {
  name: 'Test',
  joinOpen: true,
  songs: { s1: { order: 1, spotifyUri: TRACK, startMs: 0, secondsPerQuestion: 20 } },
  questions: {
    q1: { songId: 's1', order: 1, text: 'Vilket år släpptes låten?', answerType: 'text', options: { A: '1984', B: '1994', C: '2003', D: '2011' } },
    q2: { songId: 's1', order: 2, text: 'Vem sjunger?', answerType: 'text', options: { A: 'Wham!', B: 'ABBA', C: 'Toto', D: 'Queen' } },
    q3: { songId: 's1', order: 3, text: 'Inte rättad än', answerType: 'text', options: { A: 'a', B: 'b', C: 'c', D: 'd' } },
  },
}

const own: Record<string, Answer | null> = { q1: { choice: 'A', at: 1 }, q2: { choice: 'A', at: 2 }, q3: { choice: 'C', at: 3 } }
let pushReveal: (reveal: EventReveal) => void

beforeEach(() => {
  vi.resetAllMocks()
  mocked.subscribeReveal.mockImplementation((_e, callback) => {
    pushReveal = callback
    callback({ correct: { q1: 'B', q2: 'A' } })
    return () => {}
  })
  mocked.subscribeOwnAnswer.mockImplementation((_e, qId, _u, callback) => {
    callback(own[qId] ?? null)
    return () => {}
  })
})

afterEach(cleanup)

describe('Rättning på mobilen', () => {
  it('visar rätt svar och gästens eget svar', () => {
    render(<Review eventId="demo" uid="u1" config={config} live={{ phase: 'review', review: { qId: 'q1' } }} />)
    expect(screen.getByText('Låt 1 · fråga 1 av 3')).toBeInTheDocument()
    const rows = within(screen.getByRole('list', { name: 'Svar' })).getAllByRole('listitem')
    expect(rows.map((r) => r.textContent)).toEqual(['A1984Ditt svar', 'B1994Rätt svar', 'C2003', 'D2011'])
    expect(screen.getByRole('status')).toHaveTextContent('Nära! Ingen poäng på den här.')
  })

  it('säger Rätt när gästen hade rätt', () => {
    render(<Review eventId="demo" uid="u1" config={config} live={{ phase: 'review', review: { qId: 'q2' } }} />)
    expect(screen.getByText('Rätt · ditt svar')).toBeInTheDocument()
    expect(screen.getByRole('status')).toHaveTextContent('Rätt! +1 poäng.')
  })

  it('räknar poängen bara bland frågorna som har rättats', () => {
    render(<Review eventId="demo" uid="u1" config={config} live={{ phase: 'review', review: { qId: 'q2' } }} />)
    expect(screen.getByText('1 p')).toBeInTheDocument()
    act(() => pushReveal({ correct: { q1: 'B', q2: 'A', q3: 'C' } }))
    expect(screen.getByText('2 p')).toBeInTheDocument()
  })

  it('säger till när gästen inte svarade', () => {
    mocked.subscribeOwnAnswer.mockImplementation((_e, _q, _u, callback) => {
      callback(null)
      return () => {}
    })
    render(<Review eventId="demo" uid="u1" config={config} live={{ phase: 'review', review: { qId: 'q1' } }} />)
    expect(screen.getByRole('status')).toHaveTextContent('Du svarade inte på den här.')
    expect(screen.getByText('0 p')).toBeInTheDocument()
  })

  it('väntar innan första frågan visas, och visar inte rätt svar innan det är kopierat till reveal/', () => {
    render(<Review eventId="demo" uid="u1" config={config} live={{ phase: 'review', review: { qId: 'q3' } }} />)
    expect(screen.getByRole('heading', { name: 'Rättningen börjar snart' })).toBeInTheDocument()
    expect(screen.queryByText('Rätt svar')).not.toBeInTheDocument()
  })

  it('pointsSoFar', () => {
    expect(pointsSoFar({ q1: 'B', q2: 'A' }, { q1: { choice: 'B', at: 1 }, q2: null })).toBe(1)
    expect(pointsSoFar(undefined, {})).toBe(0)
  })
})
