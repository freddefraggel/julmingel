import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import * as data from '../data'
import type { EventConfig, EventReveal, Guess, Guest } from '../types'
import { GuessPanel } from './GuessPanel'

vi.mock('../data', () => ({
  revealNumbers: vi.fn(),
  subscribeAllGuesses: vi.fn(),
  subscribeNumbers: vi.fn(),
  subscribeReveal: vi.fn(),
}))

const mocked = vi.mocked(data)
const numbers = { vanlig: { '1': 'gb', '2': 'ga' }, alkfri: { '1': 'gx' } }
const config: EventConfig = {
  name: 'Test',
  joinOpen: true,
  gloggs: {
    ga: { class: 'vanlig', name: 'Röd', description: '' },
    gb: { class: 'vanlig', name: 'Vit', description: '' },
    gx: { class: 'alkfri', name: 'Äpple', description: '' },
  },
}
const guests: Record<string, Guest> = {
  u1: { name: 'Anna', class: 'vanlig', joinCode: 'k', joinedAt: 1 },
  u2: { name: 'Bo', class: 'vanlig', joinCode: 'k', joinedAt: 2 },
  u3: { name: 'Cia', class: 'alkfri', joinCode: 'k', joinedAt: 3 },
}
const save = vi.fn(async (write: () => Promise<void>) => {
  await write()
  return true
})

function setup(guesses: Record<string, Guess>, reveal: EventReveal = {}) {
  mocked.subscribeAllGuesses.mockImplementation((_e, callback) => {
    callback(guesses)
    return () => {}
  })
  mocked.subscribeNumbers.mockImplementation((_e, callback) => {
    callback(numbers)
    return () => {}
  })
  mocked.subscribeReveal.mockImplementation((_e, callback) => {
    callback(reveal)
    return () => {}
  })
  render(<GuessPanel eventId="demo" config={config} guests={guests} disabled={false} save={save} />)
}

beforeEach(() => {
  vi.clearAllMocks()
  mocked.revealNumbers.mockResolvedValue()
})

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
})

describe('Gissa glöggen hos admin', () => {
  it('visar hur många som har låst och glöggordningen per klass', () => {
    setup({ u1: { map: {}, locked: true }, u2: { map: { '1': 'ga' }, locked: false } })
    expect(screen.getByText('1 av 3 har låst sina gissningar')).toBeInTheDocument()
    expect(screen.getByText('1 håller på')).toBeInTheDocument()
    expect(screen.getByRole('region', { name: 'Glöggordning vanlig' })).toHaveTextContent('1Vit2Röd')
  })

  it('avslöjar glöggordningen genom att kopiera secret/numbers till reveal/numbers', async () => {
    setup({ u1: { map: {}, locked: true }, u2: { map: {}, locked: true }, u3: { map: {}, locked: true } })
    fireEvent.click(screen.getByRole('button', { name: 'Avslöja glöggordningen' }))
    await waitFor(() => expect(mocked.revealNumbers).toHaveBeenCalledWith('demo', numbers))
  })

  it('frågar först om alla inte har låst', () => {
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(false)
    setup({ u1: { map: {}, locked: true } })
    fireEvent.click(screen.getByRole('button', { name: 'Avslöja glöggordningen' }))
    expect(confirm).toHaveBeenCalledWith('2 gäster har inte låst sina gissningar. Avslöja ändå?')
    expect(mocked.revealNumbers).not.toHaveBeenCalled()
  })

  it('säger när ordningen redan är avslöjad', () => {
    setup({}, { numbers })
    expect(screen.getByText(/Glöggordningen är avslöjad/)).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Avslöja glöggordningen' })).not.toBeInTheDocument()
  })
})
