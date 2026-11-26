import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import * as data from '../data'
import type { EventConfig, Guest, LiveState } from '../types'
import { GuestLive } from './GuestLive'
import { questionNumber } from './QuizLayer'

vi.mock('../data', () => ({
  subscribeLive: vi.fn(),
  subscribeConfig: vi.fn(),
  subscribeOwnGuest: vi.fn(),
  subscribeOwnRatings: vi.fn(),
  getAssets: vi.fn(),
  subscribeServerTimeOffset: vi.fn(),
  subscribeOwnAnswer: vi.fn(() => () => {}),
  sendAnswer: vi.fn(),
  saveRatings: vi.fn(() => Promise.resolve()),
}))

const mocked = vi.mocked(data)
const TRACK = 'spotify:track:2FRnf9qhLbvw8fu4IBXx78'
const anna: Guest = { name: 'Anna', class: 'vanlig', joinCode: 'k', joinedAt: 1 }
const config: EventConfig = {
  name: 'Test',
  joinOpen: true,
  criteria: { c1: { name: 'Julkänsla', order: 1, lowIsGood: false } },
  gloggs: {
    g1: { class: 'vanlig', name: 'A', description: '' },
    g2: { class: 'vanlig', name: 'B', description: '' },
  },
  songs: { s1: { order: 1, spotifyUri: TRACK, startMs: 0, secondsPerQuestion: 20 } },
  questions: {
    q0: { songId: 's1', order: 1, text: 'Första', answerType: 'text', options: { A: 'a', B: 'b', C: 'c', D: 'd' } },
    q1: { songId: 's1', order: 2, text: 'Vilket år släpptes låten?', answerType: 'text', options: { A: '1984', B: '1994', C: '2003', D: '2011' } },
  },
}

// Servern och mobilen går i takt (offset 0). Frågan öppnas vid 100 000 och är öppen i 20 s.
const OPENED = 100_000
const tasting = { vanlig: { open: true, serving: 1, next: 2 } }
const openQuestion: LiveState = {
  stage: 'evening',
  tasting,
  quiz: { state: 'open', songId: 's1', qId: 'q1', openedAt: OPENED, durationMs: 20_000 },
}

let pushLive: (live: LiveState | null) => void

beforeEach(() => {
  vi.clearAllMocks()
  vi.useFakeTimers({ shouldAdvanceTime: true })
  vi.setSystemTime(OPENED + 2_000)
  mocked.subscribeLive.mockImplementation((_e, callback) => {
    pushLive = callback
    return () => {}
  })
  mocked.subscribeConfig.mockImplementation((_e, callback) => {
    callback(config)
    return () => {}
  })
  mocked.subscribeOwnGuest.mockImplementation((_e, _u, callback) => {
    callback(anna)
    return () => {}
  })
  mocked.subscribeOwnRatings.mockImplementation((_e, _u, callback) => {
    callback({})
    return () => {}
  })
  mocked.subscribeServerTimeOffset.mockImplementation((callback) => {
    callback(0)
    return () => {}
  })
  mocked.getAssets.mockResolvedValue({})
})

afterEach(() => {
  cleanup()
  vi.useRealTimers()
})

const question = () => screen.queryByRole('heading', { name: 'Vilket år släpptes låten?' })

describe('Quizfrågan som lager', () => {
  it('lägger frågan över startsidan, och sidan under ligger kvar', () => {
    render(<GuestLive eventId="demo" uid="u1" guest={anna} />)
    act(() => pushLive({ stage: 'evening' }))
    expect(screen.getByRole('heading', { name: 'Hej Anna!' })).toBeInTheDocument()
    act(() => pushLive({ ...openQuestion, tasting: undefined }))
    expect(screen.getByRole('dialog', { name: 'Musikquiz' })).toBeInTheDocument()
    expect(question()).toBeInTheDocument()
    // Sidan under är dold för skärmläsare men finns kvar.
    expect(screen.queryByRole('heading', { name: 'Hej Anna!' })).not.toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Hej Anna!', hidden: true })).toBeInTheDocument()
  })

  it('Till provningen stänger lagret, och rutan Ny quizfråga öppnar det igen', () => {
    render(<GuestLive eventId="demo" uid="u1" guest={anna} />)
    act(() => pushLive({ ...openQuestion, tasting: undefined }))
    fireEvent.click(screen.getByRole('button', { name: 'Till provningen' }))
    expect(question()).not.toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Hej Anna!' })).toBeInTheDocument()
    const pill = screen.getByRole('button', { name: /Ny quizfråga!/ })
    expect(pill).toHaveTextContent('Fråga 2 · 18 s kvar')
    expect(pill).toHaveTextContent('Svara')
    fireEvent.click(pill)
    expect(question()).toBeInTheDocument()
  })

  it('ett påbörjat betyg finns kvar när frågan har visats', () => {
    render(<GuestLive eventId="demo" uid="u1" guest={anna} />)
    act(() => pushLive({ stage: 'evening', tasting }))
    expect(screen.getByRole('heading', { name: 'Glögg nr 1' })).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Julkänsla 4' }))
    act(() => pushLive(openQuestion))
    expect(question()).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Till provningen' }))
    expect(screen.getByRole('heading', { name: 'Glögg nr 1' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Julkänsla 4' })).toHaveAttribute('aria-pressed', 'true')
    expect(mocked.saveRatings).toHaveBeenCalledWith('demo', 'u1', '1', { c1: 4 })
  })

  it('Tiden är ute ligger kvar tills gästen går Till provningen, och gästen är då där hen var', () => {
    render(<GuestLive eventId="demo" uid="u1" guest={anna} />)
    act(() => pushLive({ stage: 'evening', tasting }))
    act(() => pushLive(openQuestion))
    act(() => vi.advanceTimersByTime(18_500))
    expect(screen.getByRole('heading', { name: 'Tiden är ute!' })).toBeInTheDocument()
    expect(screen.getByText(/Tryck på Till provningen när du vill/)).toBeInTheDocument()
    // Ingen automatisk flytt, inte ens efter en lång stund.
    act(() => vi.advanceTimersByTime(60_000))
    expect(screen.getByRole('heading', { name: 'Tiden är ute!' })).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Till provningen' }))
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Glögg nr 1' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Ny quizfråga!/ })).not.toBeInTheDocument()
  })

  it('när admin stänger frågan tidigt visas Tiden är ute, tills nästa fråga visas', () => {
    render(<GuestLive eventId="demo" uid="u1" guest={anna} />)
    act(() => pushLive(openQuestion))
    act(() => pushLive({ ...openQuestion, quiz: { ...openQuestion.quiz!, state: 'closed' } }))
    expect(screen.getByRole('heading', { name: 'Tiden är ute!' })).toBeInTheDocument()
    act(() => vi.advanceTimersByTime(60_000))
    expect(screen.getByRole('heading', { name: 'Tiden är ute!' })).toBeInTheDocument()
    act(() => {
      vi.setSystemTime(OPENED + 90_000)
      pushLive({ ...openQuestion, quiz: { state: 'open', songId: 's1', qId: 'q0', openedAt: OPENED + 90_000, durationMs: 20_000 } })
    })
    expect(screen.getByRole('heading', { name: 'Första' })).toBeInTheDocument()
  })

  it('en fråga som gästen redan har stängt öppnas inte igen bara för Tiden är ute', () => {
    render(<GuestLive eventId="demo" uid="u1" guest={anna} />)
    act(() => pushLive(openQuestion))
    fireEvent.click(screen.getByRole('button', { name: 'Till provningen' }))
    act(() => pushLive({ ...openQuestion, quiz: { ...openQuestion.quiz!, state: 'closed' } }))
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('Lyssna noga läggs också som lager när låten spelar, men utan rutan', () => {
    render(<GuestLive eventId="demo" uid="u1" guest={anna} />)
    act(() => pushLive({ stage: 'evening', tasting, quiz: { state: 'playing', songId: 's1', qId: 'q1' } }))
    expect(screen.getByRole('heading', { name: 'Lyssna noga …' })).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Till provningen' }))
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Ny quizfråga!/ })).not.toBeInTheDocument()
  })

  it('inga automatiska sidbyten när provningen stängs: Ranka visar ett lugnt besked', () => {
    render(<GuestLive eventId="demo" uid="u1" guest={anna} />)
    act(() => pushLive({ stage: 'evening', tasting }))
    act(() => pushLive({ stage: 'evening', tasting: { vanlig: { open: false, serving: 1, next: 2 } } }))
    expect(screen.getByRole('heading', { name: 'Glögg nr 1' })).toBeInTheDocument()
    expect(screen.getByRole('status')).toHaveTextContent('Provningen är stängd – tack för dina betyg!')
    expect(screen.getByRole('button', { name: 'Julkänsla 4' })).toBeDisabled()
  })

  it('questionNumber räknar i hela quizet', () => {
    expect(questionNumber(config, 'q1')).toBe(2)
    expect(questionNumber(config, 'okänd')).toBe(0)
  })
})
