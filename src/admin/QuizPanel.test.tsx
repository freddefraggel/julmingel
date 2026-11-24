import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import * as data from '../data'
import * as spotify from '../spotify'
import type { Answer, EventConfig, Guest, LiveState } from '../types'
import { QuizPanel } from './QuizPanel'

vi.mock('../data', () => ({
  openQuestion: vi.fn(),
  subscribeAnswers: vi.fn(),
  subscribeAssets: vi.fn(),
  subscribeCorrect: vi.fn(),
  subscribeServerTimeOffset: vi.fn(),
}))

vi.mock('../spotify', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../spotify')>()),
  startSong: vi.fn(),
  replaySong: vi.fn(),
  pause: vi.fn(),
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

let pushAnswers: (answers: Record<string, Answer>) => void
const save = vi.fn(async (write: () => Promise<void>) => {
  await write()
  return true
})

function renderPanel(live: LiveState) {
  return render(<QuizPanel eventId="demo" config={config} live={live} guests={guests} disabled={false} save={save} />)
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.useFakeTimers({ shouldAdvanceTime: true })
  vi.setSystemTime(100_000)
  mocked.openQuestion.mockResolvedValue()
  mocked.subscribeAnswers.mockImplementation((_e, _q, callback) => {
    pushAnswers = callback
    callback({})
    return () => {}
  })
  mocked.subscribeAssets.mockImplementation((_e, callback) => {
    callback({})
    return () => {}
  })
  mocked.subscribeCorrect.mockImplementation((_e, callback) => {
    callback({ q1: 'B', q2: 'A', q3: 'C' })
    return () => {}
  })
  // Mobilens klocka går 5 s efter servern.
  mocked.subscribeServerTimeOffset.mockImplementation((callback) => {
    callback(5_000)
    return () => {}
  })
  mockedSpotify.startSong.mockImplementation(async (cue) => ({ kind: 'played', cue }))
  mockedSpotify.replaySong.mockImplementation(async (cue) => ({ kind: 'played', cue }))
})

afterEach(() => {
  cleanup()
  vi.useRealTimers()
})

describe('Musikquizet hos admin', () => {
  it('startar quizet med första frågan och första låten', async () => {
    renderPanel({ phase: 'quiz' })
    expect(screen.getByText('Inte startat')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /Starta quizet/ }))
    await waitFor(() => expect(mockedSpotify.startSong).toHaveBeenCalled())
    expect(mocked.openQuestion).toHaveBeenCalledWith('demo', 'q1', 30_000)
    expect(mockedSpotify.startSong.mock.calls[0]![0]).toMatchObject({ songId: 's1', startMs: 30_000 })
  })

  it('visar frågan, position, svar live och sekunder kvar mot serverns tid', () => {
    // Öppnad för 10 s sedan i serverns tid (mobilens 100 s + 5 s offset).
    renderPanel({ phase: 'quiz', quiz: { qId: 'q1', openedAt: 95_000, durationMs: 30_000 } })
    expect(screen.getByText('Låt 1 · fråga 1 av 2 · visas nu')).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Vilket år släpptes låten?' })).toBeInTheDocument()
    expect(screen.getByText(/Totalt fråga 1 av 3 · Svar: 0 \/ 3/)).toBeInTheDocument()
    expect(screen.getByText('20 s kvar')).toBeInTheDocument()
    act(() => pushAnswers({ u1: { choice: 'B', at: 96_000 }, u3: { choice: 'A', at: 97_000 } }))
    expect(screen.getByText(/Svar: 2 \/ 3/)).toBeInTheDocument()
    const answers = within(screen.getByRole('list', { name: 'Svar' })).getAllByRole('listitem')
    expect(answers.map((a) => a.textContent)).toEqual(['A · 1 svar1984', 'B · 1 svar1994', 'C · 0 svar2003', 'D · 0 svar2011'])
    expect(within(screen.getByRole('region', { name: 'Väntar på svar' })).getByText('Bo')).toBeInTheDocument()
    act(() => vi.advanceTimersByTime(21_000))
    expect(screen.getByText('Tiden är ute')).toBeInTheDocument()
  })

  it('visar rätt svar först när admin ber om det', () => {
    renderPanel({ phase: 'quiz', quiz: { qId: 'q1', openedAt: 95_000, durationMs: 30_000 } })
    expect(screen.queryByText(/· rätt ·/)).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Visa rätt svar' }))
    expect(screen.getByText('B · rätt · 0 svar')).toBeInTheDocument()
  })

  it('nästa fråga på samma låt startar inte låten igen', async () => {
    renderPanel({ phase: 'quiz', quiz: { qId: 'q1', openedAt: 95_000, durationMs: 30_000 } })
    const next = screen.getByRole('button', { name: /Nästa fråga/ })
    expect(next).toHaveTextContent('Samma låt fortsätter')
    fireEvent.click(next)
    await waitFor(() => expect(mocked.openQuestion).toHaveBeenCalledWith('demo', 'q2', 30_000))
    expect(mockedSpotify.startSong).not.toHaveBeenCalled()
  })

  it('första frågan på nästa låt startar den låten', async () => {
    renderPanel({ phase: 'quiz', quiz: { qId: 'q2', openedAt: 95_000, durationMs: 30_000 } })
    const next = screen.getByRole('button', { name: /Nästa fråga/ })
    expect(next).toHaveTextContent('Ny låt: låt 2 startar')
    fireEvent.click(next)
    await waitFor(() => expect(mockedSpotify.startSong).toHaveBeenCalled())
    expect(mocked.openQuestion).toHaveBeenCalledWith('demo', 'q3', 20_000)
    expect(mockedSpotify.startSong.mock.calls[0]![0]).toMatchObject({ songId: 's2' })
  })

  it('visar vad som spelar, eller instruktionen i reservläget', async () => {
    mockedSpotify.startSong.mockImplementation(async (cue) => ({
      kind: 'manual',
      cue,
      instruction: 'Starta låt 2 – Jingle Bells från 0:00',
      reason: 'Ingen Spotify-enhet vald.',
    }))
    const { rerender } = renderPanel({ phase: 'quiz', quiz: { qId: 'q2', openedAt: 95_000, durationMs: 30_000 } })
    fireEvent.click(screen.getByRole('button', { name: /Nästa fråga/ }))
    await waitFor(() => expect(mockedSpotify.startSong).toHaveBeenCalled())
    rerender(
      <QuizPanel
        eventId="demo"
        config={config}
        live={{ phase: 'quiz', quiz: { qId: 'q3', openedAt: 100_000, durationMs: 20_000 } }}
        guests={guests}
        disabled={false}
        save={save}
      />,
    )
    expect(await screen.findByText('Starta låt 2 – Jingle Bells från 0:00')).toBeInTheDocument()
    expect(screen.getByText('Spotify: Ingen Spotify-enhet vald.')).toBeInTheDocument()
  })

  it('Härnäst visar de kommande frågorna och markerar ny låt', () => {
    renderPanel({ phase: 'quiz', quiz: { qId: 'q1', openedAt: 95_000, durationMs: 30_000 } })
    const items = within(screen.getByRole('region', { name: 'Härnäst' })).getAllByRole('listitem')
    expect(items.map((i) => i.textContent)).toEqual(['Låt 1 · fråga 2 av 2Vem sjunger?', 'Ny låt · Låt 2 startarVad heter låten?'])
  })

  it('säger till när alla frågor är visade', () => {
    renderPanel({ phase: 'quiz', quiz: { qId: 'q3', openedAt: 95_000, durationMs: 20_000 } })
    expect(screen.getByText(/Alla frågor är visade/)).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Nästa fråga/ })).not.toBeInTheDocument()
  })

  it('Spela låten igen startar om låten från början', async () => {
    renderPanel({ phase: 'quiz', quiz: { qId: 'q2', openedAt: 95_000, durationMs: 30_000 } })
    fireEvent.click(screen.getByRole('button', { name: 'Spela låten igen' }))
    await waitFor(() => expect(mockedSpotify.replaySong).toHaveBeenCalled())
    expect(mockedSpotify.replaySong.mock.calls[0]![0]).toMatchObject({ songId: 's1' })
    expect(await screen.findByText(/Spelar på Spotify · Last Christmas – Wham!/)).toBeInTheDocument()
  })
})
