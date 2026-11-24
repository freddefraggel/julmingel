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

const names = () => within(screen.getByRole('list')).getAllByRole('listitem').map((li) => li.textContent)

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

  it('efter sista steget: Kvällens glögg med nummer och Dina gissningar', () => {
    reveal = { numbers: { vanlig: { '1': 'g2', '2': 'g1' }, alkfri: { '1': 'g3' } } }
    guess = { map: { '1': 'g2', '2': 'g1' }, locked: true }
    render(<Leaderboard eventId="demo" uid="u5" guestClass="vanlig" config={config} step={4} final={false} />)
    act(() =>
      pushResults({
        leaderboard: { u1: entry('Anna', 1, 9), u5: entry('Eva', 2, 2) },
        gloggOfEvening: { vanlig: { gId: 'g1', avg: 4.6 }, alkfri: { gId: 'g3', avg: 4.83 } },
      }),
    )
    const glogg = screen.getByRole('region', { name: 'Kvällens glögg' })
    expect(glogg).toHaveTextContent('2VanligPortvinsglögg · 4,6')
    expect(glogg).toHaveTextContent('1AlkoholfriÄppelglögg · 4,8')
    expect(screen.getByRole('region', { name: 'Dina gissningar' })).toHaveTextContent('Du gissade 2 av 2 rätt – snyggt!')
    expect(names()).toEqual(['1Anna9 p', '2Eva · du2 p'])
  })

  it('sortedRows: placering, sedan poäng, stjärnor och namn', () => {
    expect(
      sortedRows({ a: entry('Örjan', 2, 3), b: entry('Åsa', 2, 3), c: entry('Bo', 1, 5) }).map((r) => r.name),
    ).toEqual(['Bo', 'Åsa', 'Örjan'])
  })
})
