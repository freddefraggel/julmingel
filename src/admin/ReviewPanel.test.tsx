import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import * as data from '../data'
import * as spotify from '../spotify'
import type { Answer, Choice, EventConfig, Guest, LiveState } from '../types'
import { ReviewPanel } from './ReviewPanel'

vi.mock('../data', () => ({
  showReview: vi.fn(),
  subscribeAnswers: vi.fn(),
  subscribeAssets: vi.fn(),
  subscribeCorrect: vi.fn(),
}))

vi.mock('../spotify', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../spotify')>()),
  replaySong: vi.fn(),
}))

const mocked = vi.mocked(data)
const mockedSpotify = vi.mocked(spotify)
const TRACK = 'spotify:track:2FRnf9qhLbvw8fu4IBXx78'

const config: EventConfig = {
  name: 'Test',
  joinOpen: true,
  songs: {
    s1: { order: 1, spotifyUri: TRACK, title: 'Last Christmas', artist: 'Wham!', startMs: 30_000, secondsPerQuestion: 30 },
    s2: { order: 2, spotifyUri: TRACK, title: 'Jingle Bells', startMs: 0, secondsPerQuestion: 20 },
  },
  questions: {
    q1: { songId: 's1', order: 1, text: 'Vilket år släpptes låten?', answerType: 'text', options: { A: '1984', B: '1994', C: '2003', D: '2011' } },
    q2: { songId: 's1', order: 2, text: 'Vem sjunger?', answerType: 'text', options: { A: 'Wham!', B: 'ABBA', C: 'Toto', D: 'Queen' } },
    q3: { songId: 's2', order: 3, text: 'Vad heter låten?', answerType: 'text', options: { A: 'a', B: 'b', C: 'c', D: 'd' } },
  },
}
const guests: Record<string, Guest> = {
  u1: { name: 'Anna', class: 'vanlig', joinCode: 'k', joinedAt: 1 },
  u2: { name: 'Bo', class: 'vanlig', joinCode: 'k', joinedAt: 2 },
  u3: { name: 'Cia', class: 'alkfri', joinCode: 'k', joinedAt: 3 },
}

let pushCorrect: (correct: Record<string, Choice>) => void
let pushAnswers: (answers: Record<string, Answer>) => void
const save = vi.fn(async (write: () => Promise<void>) => {
  await write()
  return true
})

function renderPanel(live: LiveState) {
  return render(<ReviewPanel eventId="demo" config={config} live={live} guests={guests} disabled={false} save={save} />)
}

beforeEach(() => {
  vi.clearAllMocks()
  mocked.showReview.mockResolvedValue()
  mocked.subscribeCorrect.mockImplementation((_e, callback) => {
    pushCorrect = callback
    callback({ q1: 'B', q2: 'A', q3: 'C' })
    return () => {}
  })
  mocked.subscribeAnswers.mockImplementation((_e, _q, callback) => {
    pushAnswers = callback
    callback({})
    return () => {}
  })
  mocked.subscribeAssets.mockImplementation((_e, callback) => {
    callback({})
    return () => {}
  })
  mockedSpotify.replaySong.mockImplementation(async (cue) => ({ kind: 'played', cue }))
})

afterEach(cleanup)

describe('Rättning hos admin', () => {
  it('börjar med fråga 1 och kopierar rätt svar till reveal/ i samma anrop', async () => {
    renderPanel({ stage: 'wrapup', wrapup: { step: 'review' } })
    expect(screen.getByText('Rättningen har inte börjat')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /Börja med fråga 1/ }))
    await waitFor(() => expect(mocked.showReview).toHaveBeenCalledWith('demo', 'q1', 'B'))
  })

  it('visar hur många som hade rätt och svarsfördelningen', () => {
    renderPanel({ stage: 'wrapup', wrapup: { step: 'review', qId: 'q1' } })
    act(() => pushAnswers({ u1: { choice: 'B', at: 1 }, u2: { choice: 'A', at: 2 }, u3: { choice: 'B', at: 3 } }))
    expect(screen.getByText('Låt 1 · fråga 1 av 2 · totalt 1 av 3')).toBeInTheDocument()
    expect(screen.getByText('2 av 3 hade rätt')).toBeInTheDocument()
    const rows = within(screen.getByRole('list', { name: 'Svarsfördelning' })).getAllByRole('listitem')
    expect(rows.map((r) => r.textContent)).toEqual(['A19841 svar', 'B19942 svar · rätt', 'C20030 svar', 'D20110 svar'])
  })

  it('bläddrar med Föregående och Nästa, och direkt i listan', async () => {
    renderPanel({ stage: 'wrapup', wrapup: { step: 'review', qId: 'q2' } })
    fireEvent.click(screen.getByRole('button', { name: 'Föregående' }))
    await waitFor(() => expect(mocked.showReview).toHaveBeenLastCalledWith('demo', 'q1', 'B'))
    expect(screen.getByRole('button', { name: /Nästa fråga/ })).toHaveTextContent('Ny låt: Jingle Bells')
    fireEvent.click(screen.getByRole('button', { name: /Nästa fråga/ }))
    await waitFor(() => expect(mocked.showReview).toHaveBeenLastCalledWith('demo', 'q3', 'C'))
    const nav = screen.getByRole('navigation', { name: 'Alla frågor' })
    expect(within(nav).getByRole('button', { name: 'Fråga 2' })).toHaveAttribute('aria-current', 'true')
    fireEvent.click(within(nav).getByRole('button', { name: 'Fråga 1' }))
    await waitFor(() => expect(mocked.showReview).toHaveBeenLastCalledWith('demo', 'q1', 'B'))
  })

  it('kan inte visa en fråga som saknar rätt svar', () => {
    renderPanel({ stage: 'wrapup', wrapup: { step: 'review' } })
    act(() => pushCorrect({ q1: 'B' }))
    expect(screen.getByRole('button', { name: 'Fråga 2, saknar rätt svar' })).toBeDisabled()
  })

  it('efter sista frågan pekar den vidare', () => {
    renderPanel({ stage: 'wrapup', wrapup: { step: 'review', qId: 'q3' } })
    expect(screen.getByText(/Sista frågan är rättad/)).toBeInTheDocument()
  })

  it('Spela låten igen spelar frågans låt', async () => {
    renderPanel({ stage: 'wrapup', wrapup: { step: 'review', qId: 'q2' } })
    expect(screen.getByText('Spelar från 0:30')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Spela låten igen' }))
    await waitFor(() => expect(mockedSpotify.replaySong).toHaveBeenCalled())
    expect(mockedSpotify.replaySong.mock.calls[0]![0]).toMatchObject({ songId: 's1', startMs: 30_000 })
  })
})
