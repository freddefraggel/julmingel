import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import * as data from '../data'
import * as spotify from '../spotify'
import type { Answer, EventConfig, Guest, LiveState } from '../types'
import { QuizPanel } from './QuizPanel'

vi.mock('../data', () => ({
  openQuestion: vi.fn(),
  playSong: vi.fn(),
  closeQuestion: vi.fn(),
  setQuizIdle: vi.fn(),
  setAnsweredCount: vi.fn(),
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

/** En öppen fråga, öppnad vid servertid 95 000. Mobilens klocka står på 100 000 och servern ligger 5 s före. */
const open = (qId: string, extra: Partial<LiveState> = {}): LiveState => ({
  stage: 'evening',
  quiz: { state: 'open', songId: qId === 'q3' ? 's2' : 's1', qId, openedAt: 95_000, durationMs: qId === 'q3' ? 20_000 : 30_000 },
  ...extra,
})

const primary = () => screen.getByRole('button', { name: /^(Spela låt \d|Visa fråga|Fråga \d|Alla frågor)/ })

beforeEach(() => {
  vi.clearAllMocks()
  vi.useFakeTimers({ shouldAdvanceTime: true })
  vi.setSystemTime(100_000)
  mocked.openQuestion.mockResolvedValue()
  mocked.playSong.mockResolvedValue()
  mocked.closeQuestion.mockResolvedValue()
  mocked.setQuizIdle.mockResolvedValue()
  mocked.setAnsweredCount.mockResolvedValue()
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

describe('Musikquizet hos admin: Spela låt, sedan Visa fråga', () => {
  it('idle: Spela låt 1 startar låten utan fråga och utan tid', async () => {
    renderPanel({ stage: 'evening', quiz: { state: 'idle' } })
    expect(screen.getByText('Gästerna ser provningen – ingen fråga')).toBeInTheDocument()
    expect(screen.queryByRole('list', { name: 'Svar' })).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Spela låt 1' }))
    await waitFor(() => expect(mockedSpotify.startSong).toHaveBeenCalled())
    expect(mocked.playSong).toHaveBeenCalledWith('demo', 's1', 'q1')
    expect(mocked.openQuestion).not.toHaveBeenCalled()
    expect(mockedSpotify.startSong.mock.calls[0]![0]).toMatchObject({ songId: 's1', startMs: 30_000 })
  })

  it('playing: Visa fråga 1 startar tiden, och låten startas inte igen', async () => {
    renderPanel({ stage: 'evening', quiz: { state: 'playing', songId: 's1', qId: 'q1' } })
    expect(screen.getByText('Gästerna ser ”Lyssna noga …” – ingen timer')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Visa fråga 1' }))
    await waitFor(() => expect(mocked.openQuestion).toHaveBeenCalledWith('demo', 'q1', 's1', 30_000))
    expect(mockedSpotify.startSong).not.toHaveBeenCalled()
  })

  it('open: knappen är avstängd och visar sekunderna kvar mot serverns tid', () => {
    renderPanel(open('q1'))
    expect(primary()).toBeDisabled()
    expect(primary()).toHaveTextContent('Fråga 1 är öppen · 20 s kvar')
    expect(screen.getByText('Låt 1 · fråga 1 av 2 · öppen')).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Vilket år släpptes låten?' })).toBeInTheDocument()
    act(() => pushAnswers({ u1: { choice: 'B', at: 96_000 }, u3: { choice: 'A', at: 97_000 } }))
    expect(screen.getByText(/Svar: 2 \/ 3/)).toBeInTheDocument()
    const answers = within(screen.getByRole('list', { name: 'Svar' })).getAllByRole('listitem')
    expect(answers.map((a) => a.textContent)).toEqual(['A · 1 svar1984', 'B · 1 svar1994', 'C · 0 svar2003', 'D · 0 svar2011'])
    expect(within(screen.getByRole('region', { name: 'Väntar på svar' })).getByText('Bo')).toBeInTheDocument()
  })

  it('stänger frågan när tiden är ute, en gång', async () => {
    renderPanel(open('q1'))
    act(() => vi.advanceTimersByTime(21_000))
    await waitFor(() => expect(mocked.closeQuestion).toHaveBeenCalledWith('demo'))
    act(() => vi.advanceTimersByTime(2_000))
    expect(mocked.closeQuestion).toHaveBeenCalledTimes(1)
  })

  it('Stäng frågan nu stänger direkt', async () => {
    renderPanel(open('q1'))
    fireEvent.click(screen.getByRole('button', { name: 'Stäng frågan nu' }))
    await waitFor(() => expect(mocked.closeQuestion).toHaveBeenCalledWith('demo'))
  })

  it('closed: nästa fråga på samma låt visas direkt, utan att låten startas om', async () => {
    renderPanel({ stage: 'evening', quiz: { state: 'closed', songId: 's1', qId: 'q1', openedAt: 60_000, durationMs: 30_000 } })
    expect(screen.getByText('Gästerna är tillbaka i provningen')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Visa fråga 2 · samma låt' }))
    await waitFor(() => expect(mocked.openQuestion).toHaveBeenCalledWith('demo', 'q2', 's1', 30_000))
    expect(mocked.playSong).not.toHaveBeenCalled()
    expect(mockedSpotify.startSong).not.toHaveBeenCalled()
  })

  it('closed på sista frågan till en låt: Spela låt 2', async () => {
    renderPanel({ stage: 'evening', quiz: { state: 'closed', songId: 's1', qId: 'q2', openedAt: 60_000, durationMs: 30_000 } })
    fireEvent.click(screen.getByRole('button', { name: 'Spela låt 2' }))
    await waitFor(() => expect(mocked.playSong).toHaveBeenCalledWith('demo', 's2', 'q3'))
    expect(mockedSpotify.startSong.mock.calls[0]![0]).toMatchObject({ songId: 's2' })
  })

  it('efter sista frågan är quizet klart', () => {
    renderPanel({ stage: 'evening', quiz: { state: 'closed', songId: 's2', qId: 'q3', openedAt: 60_000, durationMs: 20_000 } })
    expect(primary()).toBeDisabled()
    expect(primary()).toHaveTextContent('Alla frågor klara – starta rättningen när ni vill')
  })

  it('Pausa låten stannar och fortsätter med samma låt sedan', async () => {
    renderPanel({ stage: 'evening', quiz: { state: 'playing', songId: 's1', qId: 'q1' } })
    fireEvent.click(screen.getByRole('button', { name: 'Pausa låten' }))
    await waitFor(() => expect(mocked.setQuizIdle).toHaveBeenCalledWith('demo', 'q1'))
  })

  it('Hoppa över låten går till första frågan på nästa låt', async () => {
    renderPanel({ stage: 'evening', quiz: { state: 'idle', qId: 'q1' } })
    fireEvent.click(screen.getByRole('button', { name: 'Hoppa över låten' }))
    await waitFor(() => expect(mocked.setQuizIdle).toHaveBeenCalledWith('demo', 'q3'))
  })

  it('idle med qId fortsätter där quizet pausades', () => {
    renderPanel({ stage: 'evening', quiz: { state: 'idle', qId: 'q3' } })
    expect(screen.getByRole('button', { name: 'Spela låt 2' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Hoppa över låten' })).not.toBeInTheDocument()
  })

  it('visar rätt svar först när admin ber om det', () => {
    renderPanel(open('q1'))
    expect(screen.queryByText(/· rätt ·/)).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Visa rätt svar' }))
    expect(screen.getByText('B · rätt · 0 svar')).toBeInTheDocument()
  })

  it('visar vad som spelar, eller instruktionen i reservläget', async () => {
    mockedSpotify.startSong.mockImplementation(async (cue) => ({
      kind: 'manual',
      cue,
      instruction: 'Starta låt 2 – Jingle Bells från 0:00',
      reason: 'Ingen Spotify-enhet vald.',
    }))
    const { rerender } = renderPanel({ stage: 'evening', quiz: { state: 'idle', qId: 'q3' } })
    fireEvent.click(screen.getByRole('button', { name: 'Spela låt 2' }))
    await waitFor(() => expect(mockedSpotify.startSong).toHaveBeenCalled())
    rerender(
      <QuizPanel
        eventId="demo"
        config={config}
        live={{ stage: 'evening', quiz: { state: 'playing', songId: 's2', qId: 'q3' } }}
        guests={guests}
        disabled={false}
        save={save}
      />,
    )
    expect(await screen.findByText('Starta låt 2 – Jingle Bells från 0:00')).toBeInTheDocument()
    expect(screen.getByText('Spotify: Ingen Spotify-enhet vald.')).toBeInTheDocument()
  })

  it('Härnäst visar de kommande frågorna och markerar ny låt', () => {
    renderPanel(open('q1'))
    const items = within(screen.getByRole('region', { name: 'Härnäst' })).getAllByRole('listitem')
    expect(items.map((i) => i.textContent)).toEqual(['Låt 1 · fråga 2 av 2Vem sjunger?', 'Ny låt · Låt 2 startarVad heter låten?'])
  })

  it('skriver antalet svar till live/answered åt gästerna, men inte vilka svar', () => {
    renderPanel(open('q1'))
    expect(mocked.setAnsweredCount).toHaveBeenLastCalledWith('demo', { qId: 'q1', count: 0, total: 3 })
    act(() => pushAnswers({ u1: { choice: 'B', at: 96_000 }, u2: { choice: 'C', at: 97_000 } }))
    expect(mocked.setAnsweredCount).toHaveBeenLastCalledWith('demo', { qId: 'q1', count: 2, total: 3 })
  })

  it('skriver inte om live/answered när det redan stämmer, och inget medan låten bara spelar', () => {
    renderPanel(open('q1', { answered: { qId: 'q1', count: 0, total: 3 } }))
    expect(mocked.setAnsweredCount).not.toHaveBeenCalled()
    cleanup()
    renderPanel({ stage: 'evening', quiz: { state: 'playing', songId: 's1', qId: 'q1' } })
    expect(mocked.setAnsweredCount).not.toHaveBeenCalled()
  })

  it('Spela låten igen startar om låten från början', async () => {
    renderPanel(open('q2'))
    fireEvent.click(screen.getByRole('button', { name: 'Spela låten igen' }))
    await waitFor(() => expect(mockedSpotify.replaySong).toHaveBeenCalled())
    expect(mockedSpotify.replaySong.mock.calls[0]![0]).toMatchObject({ songId: 's1' })
    expect(await screen.findByText(/Spelar på Spotify · Last Christmas – Wham!/)).toBeInTheDocument()
  })
})
