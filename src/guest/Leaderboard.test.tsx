import { act, cleanup, render, screen, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import * as data from '../data'
import type { EventConfig, EventResults, EventReveal, Guess } from '../types'
import { Leaderboard, sortedRows } from './Leaderboard'

vi.mock('../data', () => ({
  subscribeResults: vi.fn(),
  subscribeReveal: vi.fn(),
  subscribeOwnGuess: vi.fn(),
}))

const mocked = vi.mocked(data)
const config: EventConfig = {
  name: 'Test',
  joinOpen: false,
  gloggs: {
    g1: { class: 'vanlig', name: 'Portvinsglögg', description: '' },
    g2: { class: 'vanlig', name: 'Vit glögg', description: '' },
    g3: { class: 'alkfri', name: 'Äppelglögg', description: '' },
  },
}
const entry = (name: string, rank: number, points: number) => ({ name, rank, points, stars: 0 })

let pushResults: (results: EventResults) => void
let reveal: EventReveal
let guess: Guess | null

beforeEach(() => {
  vi.resetAllMocks()
  reveal = {}
  guess = null
  mocked.subscribeResults.mockImplementation((_e, callback) => {
    pushResults = callback
    callback({})
    return () => {}
  })
  mocked.subscribeReveal.mockImplementation((_e, callback) => {
    callback(reveal)
    return () => {}
  })
  mocked.subscribeOwnGuess.mockImplementation((_e, _u, callback) => {
    callback(guess)
    return () => {}
  })
})

afterEach(cleanup)

const names = () =>
  within(within(screen.getByRole('region', { name: 'Musikquiz' })).getByRole('list'))
    .getAllByRole('listitem')
    .map((li) => li.textContent)

describe('Topplistan på mobilen', () => {
  it('väntar tills avslöjandet börjar', () => {
    render(<Leaderboard eventId="demo" uid="u5" guestClass="vanlig" config={config} step={null} final={false} />)
    expect(screen.getByRole('heading', { name: 'Snart dags!' })).toBeInTheDocument()
  })

  it('visar plats 5 och nedåt med topp 4 som frågetecken, och följer stegen', () => {
    const { rerender } = render(<Leaderboard eventId="demo" uid="u5" guestClass="vanlig" config={config} step={0} final={false} />)
    act(() => pushResults({ leaderboard: { u5: entry('Eva', 5, 2), u6: entry('Fia', 6, 1) } }))
    expect(names()).toEqual(['1?', '2?', '3?', '4?', '5Eva · du2 p', '6Fia1 p'])
    expect(screen.getByRole('listitem', { current: true })).toHaveTextContent('Eva')
    rerender(<Leaderboard eventId="demo" uid="u5" guestClass="vanlig" config={config} step={1} final={false} />)
    act(() => pushResults({ leaderboard: { u4: entry('Dan', 4, 3), u5: entry('Eva', 5, 2), u6: entry('Fia', 6, 1) } }))
    expect(names()).toEqual(['1?', '2?', '3?', '4Dan3 p', '5Eva · du2 p', '6Fia1 p'])
  })

  it('efter sista steget: avsnitten Glöggprovning och Musikquiz', () => {
    reveal = { numbers: { vanlig: { '1': 'g2', '2': 'g1' }, alkfri: { '1': 'g3' } } }
    guess = { map: { '1': 'g2', '2': 'g1' }, locked: true }
    render(<Leaderboard eventId="demo" uid="u5" guestClass="vanlig" config={config} step={4} final={false} />)
    act(() =>
      pushResults({
        leaderboard: { u1: entry('Anna', 1, 9), u5: entry('Eva', 2, 2) },
        gloggOfEvening: { vanlig: { gId: 'g1', avg: 4.6 }, alkfri: { gId: 'g3', avg: 4.83 } },
      }),
    )
    const tasting = screen.getByRole('region', { name: 'Glöggprovning' })
    expect(within(tasting).getByRole('heading', { name: 'Glöggprovning' })).toBeInTheDocument()
    expect(tasting).toHaveTextContent('VanligPortvinsglöggnr 2 · snitt 4,6 av 5')
    expect(tasting).toHaveTextContent('AlkoholfriÄppelglöggnr 1 · snitt 4,8 av 5')
    expect(tasting).toHaveTextContent('Gissa glöggen')
    expect(tasting).toHaveTextContent('Du gissade 2 av 2 rätt – snyggt!')
    expect(within(screen.getByRole('region', { name: 'Musikquiz' })).getByRole('heading', { name: 'Musikquiz' })).toBeInTheDocument()
    expect(names()).toEqual(['1Anna9 p', '2Eva · du2 p'])
  })

  it('facit för Gissa glöggen visar varje nummer, rätt glögg och vad gästen gissade', () => {
    reveal = { numbers: { vanlig: { '1': 'g2', '2': 'g1' } } }
    guess = { map: { '1': 'g1', '2': 'g2' }, locked: true }
    render(<Leaderboard eventId="demo" uid="u5" guestClass="vanlig" config={config} step={4} final />)
    act(() => pushResults({ leaderboard: { u5: entry('Eva', 1, 2) }, gloggOfEvening: { vanlig: { gId: 'g1', avg: 4 } } }))
    expect(screen.getByText('Du gissade 0 av 2 rätt.')).toBeInTheDocument()
    const facit = screen.getByText('Visa facit').closest('details')!
    expect(within(facit).getAllByRole('listitem').map((li) => li.textContent)).toEqual([
      'nr 1Vit glögg · du gissade PortvinsglöggFel',
      'nr 2Portvinsglögg · du gissade Vit glöggFel',
    ])
  })

  it('sortedRows: placering, sedan poäng, stjärnor och namn', () => {
    expect(
      sortedRows({ a: entry('Örjan', 2, 3), b: entry('Åsa', 2, 3), c: entry('Bo', 1, 5) }).map((r) => r.name),
    ).toEqual(['Bo', 'Åsa', 'Örjan'])
  })
})
