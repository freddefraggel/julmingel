import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import * as data from '../data'
import type { EventConfig, Guest, LiveState } from '../types'
import { GuestAssets } from './assets'
import { Gloggs, gloggsInSecretOrder } from './Gloggs'
import { GuestLive } from './GuestLive'

vi.mock('../data', () => ({
  subscribeServerTimeOffset: vi.fn(() => () => {}),
  subscribeOwnAnswer: vi.fn(() => () => {}),
  saveRatings: vi.fn(),
  subscribeLive: vi.fn(),
  subscribeConfig: vi.fn(),
  subscribeOwnGuest: vi.fn(),
  subscribeOwnRatings: vi.fn(),
  getAssets: vi.fn(),
}))

const mocked = vi.mocked(data)

const gloggs: EventConfig['gloggs'] = {
  '-Nz3': { class: 'vanlig', name: 'Portvinsglögg', description: 'Fyllig och söt.' },
  '-Na1': { class: 'vanlig', name: 'Vit glögg', description: '', imageId: 'i1' },
  '-Nb2': { class: 'alkfri', name: 'Äppelglögg', description: 'Alkoholfri.' },
  '-Nm7': { class: 'vanlig', name: 'Klassisk röd', description: 'Kanel och nejlika.' },
}

afterEach(cleanup)

describe('Kvällens glögger', () => {
  it('visar gästens klass sorterad på gId, inte på nummer eller namn', () => {
    expect(gloggsInSecretOrder(gloggs, 'vanlig').map((g) => g.gId)).toEqual(['-Na1', '-Nm7', '-Nz3'])
    expect(gloggsInSecretOrder(gloggs, 'alkfri').map((g) => g.name)).toEqual(['Äppelglögg'])
    expect(gloggsInSecretOrder(undefined, 'vanlig')).toEqual([])
  })

  it('visar bild, namn och beskrivning', () => {
    render(
      <GuestAssets.Provider value={{ i1: 'data:image/webp;base64,AAA' }}>
        <Gloggs gloggs={gloggs} guestClass="vanlig" onBack={() => {}} />
      </GuestAssets.Provider>,
    )
    const cards = screen.getAllByRole('listitem')
    expect(cards.map((c) => c.textContent)).toEqual(['Vit glögg', 'Klassisk rödKanel och nejlika.', 'PortvinsglöggFyllig och söt.'])
    expect(cards[0]!.querySelector('img')).toHaveAttribute('src', 'data:image/webp;base64,AAA')
    expect(cards[1]!.querySelector('img')).toBeNull()
    expect(screen.queryByText('Äppelglögg')).not.toBeInTheDocument()
  })

  it('säger till när det inte finns några glögger', () => {
    render(<Gloggs gloggs={{}} guestClass="alkfri" onBack={() => {}} />)
    expect(screen.getByText('Värden har inte lagt in några glögger än.')).toBeInTheDocument()
  })
})

describe('Kvällens glögger från Hem', () => {
  const anna: Guest = { name: 'Anna', class: 'vanlig', joinCode: 'k', joinedAt: 1 }
  let pushLive: (live: LiveState | null) => void

  beforeEach(() => {
    vi.resetAllMocks()
    mocked.subscribeLive.mockImplementation((_e, callback) => {
      pushLive = callback
      return () => {}
    })
    mocked.subscribeConfig.mockImplementation((_e, callback) => {
      callback({ name: 'Test', joinOpen: true, gloggs })
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
  })

  it('öppnas från Hem och Tillbaka går till Hem', () => {
    render(<GuestLive eventId="demo" uid="u1" guest={anna} />)
    act(() => pushLive({ stage: 'evening' }))
    fireEvent.click(screen.getByRole('button', { name: 'Se kvällens glögger' }))
    expect(screen.getByRole('heading', { name: 'Kvällens glögger' })).toBeInTheDocument()
    expect(screen.getAllByRole('listitem')).toHaveLength(3)
    fireEvent.click(screen.getByRole('button', { name: 'Tillbaka' }))
    expect(screen.getByRole('heading', { name: 'Hej Anna!' })).toBeInTheDocument()
  })
})
