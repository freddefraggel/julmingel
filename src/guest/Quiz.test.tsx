import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import * as data from '../data'
import type { Answer, EventConfig, LiveState } from '../types'
import { GuestAssets } from './assets'
import { Quiz, questionPosition } from './Quiz'

vi.mock('../data', () => ({
  sendAnswer: vi.fn(),
  subscribeOwnAnswer: vi.fn(),
  subscribeServerTimeOffset: vi.fn(),
}))

const mocked = vi.mocked(data)
const TRACK = 'spotify:track:2FRnf9qhLbvw8fu4IBXx78'

const config: EventConfig = {
  name: 'Test',
  joinOpen: true,
  songs: {
    s1: { order: 1, spotifyUri: TRACK, startMs: 0, secondsPerQuestion: 20 },
    s2: { order: 2, spotifyUri: TRACK, startMs: 0, secondsPerQuestion: 20 },
  },
  questions: {
    q1: { songId: 's2', order: 3, text: 'Vilket år släpptes låten?', answerType: 'text', options: { A: '1984', B: '1994', C: '2003', D: '2011' } },
    q2: { songId: 's2', order: 4, text: 'Vilken film är låten från?', answerType: 'image', options: { A: 'i1', B: 'i2', C: 'i3', D: 'i4' } },
    q0: { songId: 's1', order: 1, text: 'Första', answerType: 'text', options: { A: 'a', B: 'b', C: 'c', D: 'd' } },
  },
}

// Servern ligger 5 s före mobilens klocka. Frågan öppnades vid servertid 100 000 och är öppen i 20 s.
const OFFSET = 5_000
const OPENED = 100_000
const live = (qId = 'q1', extra: Partial<LiveState> = {}): LiveState => ({
  stage: 'evening',
  quiz: { state: 'open', songId: 's2', qId, openedAt: OPENED, durationMs: 20_000 },
  ...extra,
})

let pushAnswer: (answer: Answer | null) => void

function renderQuiz(state: LiveState = live()) {
  return render(
    <GuestAssets.Provider value={{ i1: 'data:image/webp;base64,AAA' }}>
      <Quiz eventId="demo" uid="u1" config={config} live={state} />
    </GuestAssets.Provider>,
  )
}

/** Sätter mobilens klocka så att servertiden blir `serverTime`. */
const atServerTime = (serverTime: number) => vi.setSystemTime(serverTime - OFFSET)

beforeEach(() => {
  vi.resetAllMocks()
  vi.useFakeTimers({ shouldAdvanceTime: true })
  atServerTime(OPENED + 2_000)
  mocked.subscribeServerTimeOffset.mockImplementation((callback) => {
    callback(OFFSET)
    return () => {}
  })
  mocked.subscribeOwnAnswer.mockImplementation((_e, _q, _u, callback) => {
    pushAnswer = callback
    callback(null)
    return () => {}
  })
  mocked.sendAnswer.mockResolvedValue()
})

afterEach(() => {
  cleanup()
  vi.useRealTimers()
})

describe('questionPosition', () => {
  it('ger låt och fråga inom låten', () => {
    expect(questionPosition(config, 'q1')).toMatchObject({ label: 'Låt 2 · fråga 1 av 2', sameSongNext: true })
    expect(questionPosition(config, 'q2')).toMatchObject({ label: 'Låt 2 · fråga 2 av 2', sameSongNext: false })
    expect(questionPosition(config, 'okänd')).toBeNull()
  })
})

describe('Quizfrågan', () => {
  it('visar frågan med nedräkning mot serverns tid och tre möjliga stjärnor', () => {
    renderQuiz()
    expect(screen.getByText('Låt 2 · fråga 1 av 2')).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Vilket år släpptes låten?' })).toBeInTheDocument()
    expect(screen.getByRole('img', { name: '18 sekunder kvar' })).toBeInTheDocument()
    expect(screen.getByRole('img', { name: '3 av 3 snabbhetsstjärnor kvar' })).toBeInTheDocument()
    act(() => vi.advanceTimersByTime(8_000))
    expect(screen.getByRole('img', { name: '10 sekunder kvar' })).toBeInTheDocument()
    expect(screen.getByRole('img', { name: '1 av 3 snabbhetsstjärnor kvar' })).toBeInTheDocument()
  })

  it('skickar svaret vid varje byte', async () => {
    renderQuiz()
    fireEvent.click(screen.getByRole('button', { name: 'B: 1994' }))
    await waitFor(() => expect(mocked.sendAnswer).toHaveBeenCalledWith('demo', 'q1', 'u1', 'B'))
    act(() => pushAnswer({ choice: 'B', at: OPENED + 2_000 }))
    expect(screen.getByRole('button', { name: 'B: 1994' })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByRole('status')).toHaveTextContent('Svar skickat: B')
    fireEvent.click(screen.getByRole('button', { name: 'D: 2011' }))
    await waitFor(() => expect(mocked.sendAnswer).toHaveBeenLastCalledWith('demo', 'q1', 'u1', 'D'))
  })

  it('visar bildsvar i ett rutnät', () => {
    renderQuiz(live('q2'))
    expect(screen.getByRole('button', { name: 'Svar A' }).querySelector('img')).toHaveAttribute('src', 'data:image/webp;base64,AAA')
    expect(screen.getAllByRole('button', { name: /^Svar [A-D]$/ })).toHaveLength(4)
  })

  it('säger till när svaret inte kommer fram', async () => {
    mocked.sendAnswer.mockRejectedValue(new Error('permission_denied'))
    renderQuiz()
    fireEvent.click(screen.getByRole('button', { name: 'A: 1984' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('Svaret kom inte fram')
  })

  it('en omladdning ändrar inte sluttiden: den kommer från openedAt', () => {
    atServerTime(OPENED + 15_000)
    renderQuiz()
    expect(screen.getByRole('img', { name: '5 sekunder kvar' })).toBeInTheDocument()
  })

  it('Spela låt (5a): lyssna, inga svarsknappar och ingen timer', () => {
    renderQuiz({ stage: 'evening', quiz: { state: 'playing', songId: 's2', qId: 'q1' } })
    expect(screen.getByRole('heading', { name: 'Lyssna noga …' })).toBeInTheDocument()
    expect(screen.getByText('Frågan kommer strax.')).toBeInTheDocument()
    expect(screen.getByText('Musikquiz · låt 2')).toBeInTheDocument()
    expect(screen.getByText('2 frågor om den här låten')).toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: 'Vilket år släpptes låten?' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /^[A-D]:/ })).not.toBeInTheDocument()
    expect(screen.queryByRole('img', { name: /sekunder kvar/ })).not.toBeInTheDocument()
    expect(mocked.sendAnswer).not.toHaveBeenCalled()
  })

  it('Till provningen lämnar quizvyn', () => {
    const onLeave = vi.fn()
    render(<Quiz eventId="demo" uid="u1" config={config} live={{ stage: 'evening', quiz: { state: 'playing', songId: 's2', qId: 'q1' } }} onLeave={onLeave} />)
    fireEvent.click(screen.getByRole('button', { name: 'Till provningen' }))
    expect(onLeave).toHaveBeenCalled()
  })

  it('stjärnorna räknas från när frågan visades, inte från när låten startade', () => {
    // Låten har spelat länge; frågan visades för 2 s sedan, så alla tre stjärnor finns kvar.
    renderQuiz(live('q1'))
    expect(screen.getByRole('img', { name: '3 av 3 snabbhetsstjärnor kvar' })).toBeInTheDocument()
  })

  it('en stängd fråga är låst även om tiden inte har gått ut', () => {
    renderQuiz(live('q1', { quiz: { state: 'closed', songId: 's2', qId: 'q1', openedAt: OPENED, durationMs: 20_000 } }))
    expect(screen.getByRole('heading', { name: 'Tiden är ute!' })).toBeInTheDocument()
  })

  it('väntar när ingen fråga är öppnad än', () => {
    renderQuiz({ stage: 'evening', quiz: { state: 'idle' } })
    expect(screen.getByRole('heading', { name: 'Musikquizet börjar snart' })).toBeInTheDocument()
  })
})

describe('Tiden är ute', () => {
  it('visar det låsta svaret, stjärnorna det kan ge och hur många som har svarat', () => {
    renderQuiz(live('q1', { answered: { qId: 'q1', count: 14, total: 18 } }))
    act(() => pushAnswer({ choice: 'B', at: OPENED + 6_000 }))
    act(() => {
      atServerTime(OPENED + 20_000)
      vi.advanceTimersByTime(300)
    })
    expect(screen.getByRole('heading', { name: 'Tiden är ute!' })).toBeInTheDocument()
    expect(screen.getByText('B · 1994')).toBeInTheDocument()
    expect(screen.getByText('Snabbt! +2 stjärnor om svaret är rätt')).toBeInTheDocument()
    expect(screen.getByText('14 av 18')).toBeInTheDocument()
    expect(screen.getByText(/nästa fråga handlar om samma låt/)).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /1994/ })).not.toBeInTheDocument()
  })

  it('Till provningen finns också när tiden är ute', () => {
    const onLeave = vi.fn()
    atServerTime(OPENED + 30_000)
    render(<Quiz eventId="demo" uid="u1" config={config} live={live('q1')} onLeave={onLeave} />)
    fireEvent.click(screen.getByRole('button', { name: 'Till provningen' }))
    expect(onLeave).toHaveBeenCalled()
  })

  it('säger till när gästen inte hann svara, och visar inte förra frågans antal', () => {
    atServerTime(OPENED + 30_000)
    renderQuiz(live('q2', { answered: { qId: 'q1', count: 14, total: 18 } }))
    expect(screen.getByText('Du hann inte svara på den här frågan.')).toBeInTheDocument()
    expect(screen.getByText(/Nästa fråga kommer med en ny låt/)).toBeInTheDocument()
    expect(screen.queryByText('14 av 18')).not.toBeInTheDocument()
  })
})
