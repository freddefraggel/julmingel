import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import * as data from '../data'
import type { ResultsInput } from '../data'
import type { EventConfig, Guest, LiveState } from '../types'
import { RevealPanel } from './RevealPanel'

vi.mock('../data', () => ({
  loadResultsInput: vi.fn(),
  writeResults: vi.fn(),
}))

const mocked = vi.mocked(data)

const names = ['Anna', 'Bo', 'Cia', 'Dan', 'Eva']
const guests: Record<string, Guest> = Object.fromEntries(
  names.map((name, i) => [`u${i + 1}`, { name, class: 'vanlig' as const, joinCode: 'k', joinedAt: i }]),
)
const config: EventConfig = {
  name: 'Test',
  joinOpen: false,
  criteria: { c1: { name: 'Smak', order: 1, lowIsGood: false } },
  gloggs: { g1: { class: 'vanlig', name: 'Portvinsglögg', description: '' } },
}
// u1 har 4 rätt, u2 3, u3 2, u4 1 och u5 0.
const correct = { q1: 'A', q2: 'A', q3: 'A', q4: 'A' } as const
const timing = { openedAt: 0, durationMs: 20_000 }
const input: ResultsInput = {
  correct: { ...correct },
  quizTimes: { q1: timing, q2: timing, q3: timing, q4: timing },
  answers: Object.fromEntries(
    ['q1', 'q2', 'q3', 'q4'].map((q, qi) => [
      q,
      Object.fromEntries(['u1', 'u2', 'u3', 'u4', 'u5'].map((u, ui) => [u, { choice: ui <= 3 - qi ? 'A' : 'B', at: 1_000 }])),
    ]),
  ) as ResultsInput['answers'],
  ratings: { u1: { '1': { c1: 5 } } },
  numbers: { vanlig: { '1': 'g1' } },
}

const save = vi.fn(async (write: () => Promise<void>) => {
  await write()
  return true
})

function renderPanel(live: LiveState) {
  return render(<RevealPanel eventId="demo" config={config} live={live} guests={guests} disabled={false} save={save} />)
}

beforeEach(() => {
  vi.clearAllMocks()
  mocked.loadResultsInput.mockResolvedValue(input)
  mocked.writeResults.mockResolvedValue()
})

afterEach(cleanup)

describe('Avslöja topplistan hos admin', () => {
  it('räknar ut listan och visar plats 5 och nedåt, men döljer topp 4', async () => {
    renderPanel({ stage: 'wrapup', wrapup: { step: 'reveal' } })
    const top = await screen.findByRole('region', { name: 'Topp 4' })
    expect(within(top).getAllByText('?')).toHaveLength(4)
    expect(within(screen.getByRole('region', { name: 'Plats 5 och nedåt' })).getByText('Eva')).toBeInTheDocument()
  })

  it('steg 0 skriver hela listan i secret/ och plats 5 och nedåt i results/', async () => {
    renderPanel({ stage: 'wrapup', wrapup: { step: 'reveal' } })
    fireEvent.click(await screen.findByRole('button', { name: 'Visa plats 5 och nedåt' }))
    await waitFor(() => expect(mocked.writeResults).toHaveBeenCalled())
    const changes = mocked.writeResults.mock.calls[0]![1]
    expect(Object.keys(changes['secret/leaderboard'] as object)).toHaveLength(5)
    expect(changes['results/leaderboard']).toEqual({ u5: { points: 0, stars: 0, rank: 5, name: 'Eva' } })
  })

  it('nästa steg avslöjar 4:an, och sista steget vinnaren och Kvällens glögg', async () => {
    const { unmount } = renderPanel({ stage: 'wrapup', wrapup: { step: 'reveal', revealStep: 0 } })
    fireEvent.click(await screen.findByRole('button', { name: 'Avslöja 4:an' }))
    await waitFor(() =>
      expect(mocked.writeResults).toHaveBeenLastCalledWith('demo', {
        'live/wrapup/revealStep': 1,
        'results/leaderboard/u4': { points: 1, stars: 3, rank: 4, name: 'Dan' },
      }),
    )
    unmount()
    renderPanel({ stage: 'wrapup', wrapup: { step: 'reveal', revealStep: 3 } })
    fireEvent.click(await screen.findByRole('button', { name: 'Avslöja vinnaren' }))
    await waitFor(() =>
      expect(mocked.writeResults).toHaveBeenLastCalledWith('demo', {
        'live/wrapup/revealStep': 4,
        'results/leaderboard/u1': { points: 4, stars: 12, rank: 1, name: 'Anna' },
        'results/gloggOfEvening': { vanlig: { gId: 'g1', avg: 5 } },
      }),
    )
  })

  it('visar avslöjade platser och Kvällens glögg när allt är klart', async () => {
    renderPanel({ stage: 'wrapup', wrapup: { step: 'reveal', revealStep: 4 } })
    const top = await screen.findByRole('region', { name: 'Topp 4' })
    expect(within(top).getByText('Anna')).toBeInTheDocument()
    expect(within(top).getByText('4 poäng · 12 stjärnor')).toBeInTheDocument()
    expect(screen.getByText('Portvinsglögg')).toBeInTheDocument()
    expect(screen.getByText(/Hela topplistan och Kvällens glögg är avslöjade/)).toBeInTheDocument()
  })
})
