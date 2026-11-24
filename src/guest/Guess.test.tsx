import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import * as data from '../data'
import type { EventConfig, EventReveal, Guess as GuessData, Guest, LiveState } from '../types'
import { cleanMap, Guess, guessScore, pick } from './Guess'
import { GuestLive } from './GuestLive'

vi.mock('../data', () => ({
  saveGuess: vi.fn(),
  subscribeOwnGuess: vi.fn(),
  subscribeReveal: vi.fn(),
  subscribeLive: vi.fn(),
  subscribeConfig: vi.fn(),
  subscribeOwnGuest: vi.fn(),
  subscribeOwnRatings: vi.fn(),
  getAssets: vi.fn(),
}))

const mocked = vi.mocked(data)

const config: EventConfig = {
  name: 'Test',
  joinOpen: true,
  gloggs: {
    ga: { class: 'vanlig', name: 'Röd', description: '' },
    gb: { class: 'vanlig', name: 'Vit', description: '' },
    gc: { class: 'vanlig', name: 'Portvin', description: '' },
    gx: { class: 'alkfri', name: 'Äpple', description: '' },
  },
}

let pushGuess: (guess: GuessData | null) => void
let pushReveal: (reveal: EventReveal) => void

function renderGuess(phase: LiveState['phase'] = 'guess') {
  return render(<Guess eventId="demo" uid="u1" config={config} guestClass="vanlig" phase={phase} onBack={() => {}} />)
}

beforeEach(() => {
  vi.resetAllMocks()
  mocked.saveGuess.mockResolvedValue()
  mocked.subscribeOwnGuess.mockImplementation((_e, _u, callback) => {
    pushGuess = callback
    callback(null)
    return () => {}
  })
  mocked.subscribeReveal.mockImplementation((_e, callback) => {
    pushReveal = callback
    callback({})
    return () => {}
  })
})

afterEach(cleanup)

describe('hjälpfunktioner', () => {
  it('pick flyttar en glögg som redan var vald', () => {
    expect(pick({ '1': 'ga', '2': 'gb' }, '3', 'ga')).toEqual({ '2': 'gb', '3': 'ga' })
    expect(pick({ '1': 'ga' }, '1', 'gb')).toEqual({ '1': 'gb' })
  })

  it('cleanMap klarar att databasen ger en lista', () => {
    expect(cleanMap([null, 'ga', 'gb'])).toEqual({ '1': 'ga', '2': 'gb' })
    expect(cleanMap(undefined)).toEqual({})
  })

  it('guessScore räknar rätt gissade nummer', () => {
    expect(guessScore({ '1': 'ga', '2': 'gc', '3': 'gb' }, { '1': 'ga', '2': 'gb', '3': 'gc' })).toEqual({ right: 1, total: 3 })
  })
})

describe('Gissa glöggen', () => {
  it('väljer glögg till ett nummer i ett ark och sparar direkt, olåst', async () => {
    renderGuess()
    fireEvent.click(screen.getByRole('button', { name: 'Nummer 2: inte vald' }))
    const sheet = screen.getByRole('dialog', { name: 'Vilken glögg är nummer 2?' })
    expect(within(sheet).getAllByRole('button', { name: /^(Röd|Vit|Portvin)/ })).toHaveLength(3)
    fireEvent.click(within(sheet).getByRole('button', { name: 'Vit' }))
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Nummer 2: Vit' })).toBeInTheDocument()
    await waitFor(() => expect(mocked.saveGuess).toHaveBeenCalledWith('demo', 'u1', { map: { '2': 'gb' }, locked: false }))
  })

  it('varje glögg används en gång: arket visar var den redan är vald', () => {
    renderGuess()
    act(() => pushGuess({ map: { '1': 'ga' }, locked: false }))
    fireEvent.click(screen.getByRole('button', { name: 'Nummer 3: inte vald' }))
    fireEvent.click(screen.getByRole('button', { name: 'Röd, vald till nummer 1' }))
    expect(screen.getByRole('button', { name: 'Nummer 1: inte vald' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Nummer 3: Röd' })).toBeInTheDocument()
  })

  it('låser först när alla nummer har en glögg', async () => {
    renderGuess()
    act(() => pushGuess({ map: { '1': 'ga', '2': 'gb' }, locked: false }))
    expect(screen.getByRole('button', { name: 'Lås mina gissningar' })).toBeDisabled()
    act(() => pushGuess({ map: { '1': 'ga', '2': 'gb', '3': 'gc' }, locked: false }))
    fireEvent.click(screen.getByRole('button', { name: 'Lås mina gissningar' }))
    await waitFor(() =>
      expect(mocked.saveGuess).toHaveBeenCalledWith('demo', 'u1', { map: { '1': 'ga', '2': 'gb', '3': 'gc' }, locked: true }),
    )
    act(() => pushGuess({ map: { '1': 'ga', '2': 'gb', '3': 'gc' }, locked: true }))
    expect(screen.getByText('Dina gissningar är låsta.')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Nummer/ })).not.toBeInTheDocument()
  })

  it('visar facit och räknar ”Du gissade x av y rätt” när värden avslöjar', () => {
    renderGuess()
    act(() => pushGuess({ map: { '1': 'ga', '2': 'gc', '3': 'gb' }, locked: true }))
    act(() => pushReveal({ numbers: { vanlig: { '1': 'ga', '2': 'gb', '3': 'gc' }, alkfri: { '1': 'gx' } } }))
    expect(screen.getByRole('heading', { name: 'Du gissade 1 av 3 rätt' })).toBeInTheDocument()
    const rows = screen.getAllByRole('listitem').map((r) => r.textContent)
    expect(rows).toEqual(['1RödRätt', '2PortvinRätt: VitFel', '3VitRätt: PortvinFel'])
  })

  it('går inte att ändra utanför gissningsfasen', () => {
    renderGuess('reveal')
    expect(screen.getByText('Gissningen är stängd.')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Lås mina gissningar' })).not.toBeInTheDocument()
  })

  it('säger till när låsningen nekas', async () => {
    mocked.saveGuess.mockRejectedValue(new Error('permission_denied'))
    renderGuess()
    act(() => pushGuess({ map: { '1': 'ga', '2': 'gb', '3': 'gc' }, locked: false }))
    fireEvent.click(screen.getByRole('button', { name: 'Lås mina gissningar' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('Kunde inte låsa gissningarna')
  })
})

describe('Gissa glöggen i kvällens flöde', () => {
  const anna: Guest = { name: 'Anna', class: 'vanlig', joinCode: 'k', joinedAt: 1 }

  it('mobilen öppnar gissningen när fasen börjar, och Tillbaka går till Hem', () => {
    let pushLive: (live: LiveState | null) => void = () => {}
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
    mocked.getAssets.mockResolvedValue({})
    render(<GuestLive eventId="demo" uid="u1" guest={anna} />)
    act(() => pushLive({ phase: 'guess' }))
    expect(screen.getByRole('heading', { name: 'Vilken glögg är vilken?' })).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Tillbaka' }))
    expect(screen.getByRole('heading', { name: 'Hej Anna!' })).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /Gissa glöggen/ }))
    expect(screen.getByRole('heading', { name: 'Vilken glögg är vilken?' })).toBeInTheDocument()
  })
})
