import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import * as data from '../data'
import type { EventResults, Guest, LiveState } from '../types'
import { GuestLive } from './GuestLive'
import { cupFor, HomeAfter } from './HomeAfter'

vi.mock('../data', () => ({
  subscribeResults: vi.fn(),
  subscribeReveal: vi.fn(() => () => {}),
  subscribeOwnGuess: vi.fn(() => () => {}),
  subscribeLive: vi.fn(),
  subscribeConfig: vi.fn(),
  subscribeOwnGuest: vi.fn(),
  subscribeOwnRatings: vi.fn(),
  getAssets: vi.fn(),
}))

const mocked = vi.mocked(data)
const anna: Guest = { name: 'Anna', class: 'vanlig', joinCode: 'k', joinedAt: 1 }
let pushResults: (results: EventResults) => void

beforeEach(() => {
  vi.clearAllMocks()
  mocked.subscribeResults.mockImplementation((_e, callback) => {
    pushResults = callback
    return () => {}
  })
})

afterEach(cleanup)

describe('Hem efter kvällen', () => {
  it('cupFor ger guld, silver och brons för topp 3', () => {
    expect([1, 2, 3, 4].map((r) => cupFor(r)?.name ?? null)).toEqual(['Guldpokal', 'Silverpokal', 'Bronspokal', null])
  })

  it('visar pokal, placering, poäng och stjärnor från results/leaderboard', () => {
    render(<HomeAfter eventId="demo" uid="u1" guest={anna} onOpenLeaderboard={() => {}} />)
    expect(screen.getByText('Hämtar resultatet…')).toBeInTheDocument()
    act(() => pushResults({ leaderboard: { u1: { name: 'Anna', rank: 2, points: 10, stars: 22 } } }))
    expect(screen.getByText('Tack för i kväll')).toBeInTheDocument()
    expect(screen.getByRole('img', { name: 'Silverpokal' })).toBeInTheDocument()
    expect(screen.getByText('2:a plats i musikquizet')).toBeInTheDocument()
    expect(screen.getByText('10 poäng')).toBeInTheDocument()
    expect(screen.getByText('22 stjärnor')).toBeInTheDocument()
  })

  it('utan pokal från plats 4', () => {
    render(<HomeAfter eventId="demo" uid="u1" guest={anna} onOpenLeaderboard={() => {}} />)
    act(() => pushResults({ leaderboard: { u1: { name: 'Anna', rank: 5, points: 1, stars: 1 } } }))
    expect(screen.queryByRole('img', { name: /pokal/ })).not.toBeInTheDocument()
    expect(screen.getByText('Plats 5')).toBeInTheDocument()
    expect(screen.getByText('1 poäng')).toBeInTheDocument()
    expect(screen.getByText('1 stjärna')).toBeInTheDocument()
  })

  it('tackar även den som inte finns i topplistan', () => {
    render(<HomeAfter eventId="demo" uid="u9" guest={anna} onOpenLeaderboard={() => {}} />)
    act(() => pushResults({ leaderboard: {} }))
    expect(screen.getByText('Tack för att du var med!')).toBeInTheDocument()
  })

  it('länkarna öppnar topplistan med Kvällens glögg, och Tillbaka går till pokalen', () => {
    let pushLive: (live: LiveState | null) => void = () => {}
    mocked.subscribeLive.mockImplementation((_e, callback) => {
      pushLive = callback
      return () => {}
    })
    mocked.subscribeConfig.mockImplementation((_e, callback) => {
      callback({ name: 'Test', joinOpen: false })
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
    mocked.getAssets.mockResolvedValue({})
    mocked.subscribeResults.mockImplementation((_e, callback) => {
      callback({ leaderboard: { u1: { name: 'Anna', rank: 1, points: 9, stars: 20 } } })
      return () => {}
    })
    render(<GuestLive eventId="demo" uid="u1" guest={anna} />)
    act(() => pushLive({ stage: 'done', wrapup: { step: 'reveal', revealStep: 4 } }))
    expect(screen.getByRole('img', { name: 'Guldpokal' })).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Kvällens glögg' }))
    expect(screen.getByRole('heading', { name: 'Topplista' })).toBeInTheDocument()
    expect(screen.getByText('Kvällens resultat')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Tillbaka' }))
    expect(screen.getByRole('img', { name: 'Guldpokal' })).toBeInTheDocument()
  })
})
