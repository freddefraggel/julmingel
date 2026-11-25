import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import * as data from '../data'
import type { EventConfig, Guest, GuestRatings, LiveState } from '../types'
import { TastingPanel } from './TastingPanel'

vi.mock('../data', () => ({
  subscribeNumbers: vi.fn(),
  subscribeAllRatings: vi.fn(),
  subscribeAssets: vi.fn(),
  setTasting: vi.fn(),
}))

const mocked = vi.mocked(data)

const config: EventConfig = {
  name: 'Test',
  joinOpen: true,
  gloggs: {
    g1: { class: 'vanlig', name: 'Klassisk röd', description: 'Kanel och nejlika', imageId: 'i1' },
    g2: { class: 'vanlig', name: 'Vit glögg', description: '' },
    g3: { class: 'vanlig', name: 'Portvinsglögg', description: '' },
    g4: { class: 'alkfri', name: 'Äppelglögg', description: '' },
  },
}
const guests: Record<string, Guest> = {
  u1: { name: 'Anna', class: 'vanlig', joinCode: 'k', joinedAt: 1 },
  u2: { name: 'Bo', class: 'vanlig', joinCode: 'k', joinedAt: 2 },
  u3: { name: 'Cia', class: 'alkfri', joinCode: 'k', joinedAt: 3 },
}

let pushRatings: (ratings: Record<string, GuestRatings>) => void
const save = vi.fn(async (write: () => Promise<void>) => {
  await write()
  return true
})

function renderPanel(live: LiveState) {
  render(<TastingPanel eventId="demo" config={config} live={live} guests={guests} disabled={false} save={save} />)
}

beforeEach(() => {
  vi.clearAllMocks()
  mocked.subscribeNumbers.mockImplementation((_e, callback) => {
    callback({ vanlig: { '1': 'g2', '2': 'g1', '3': 'g3' }, alkfri: { '1': 'g4' } })
    return () => {}
  })
  mocked.subscribeAllRatings.mockImplementation((_e, callback) => {
    pushRatings = callback
    callback({})
    return () => {}
  })
  mocked.subscribeAssets.mockImplementation((_e, callback) => {
    callback({ i1: 'data:image/webp;base64,AAA' })
    return () => {}
  })
  mocked.setTasting.mockResolvedValue()
})

afterEach(cleanup)

describe('Glöggprovning hos admin', () => {
  it('visar flikar med nummer och antal gäster per klass', () => {
    renderPanel({ stage: 'evening', tasting: { vanlig: { open: true, serving: 2, next: 3 } } })
    expect(screen.getByRole('tab', { name: 'Vanlig · nr 2 av 3 · 2 gäster', selected: true })).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: 'Alkoholfri · 1 glögg · 1 gäst' })).toBeInTheDocument()
  })

  it('visar vad som serveras nu och hur många som har rankat', () => {
    renderPanel({ stage: 'evening', tasting: { vanlig: { open: true, serving: 2, next: 3 } } })
    const now = screen.getByRole('region', { name: 'Serveras nu' })
    expect(within(now).getByText('Nr 2')).toBeInTheDocument()
    expect(within(now).getByText('Klassisk röd')).toBeInTheDocument()
    expect(within(now).getByText('Kanel och nejlika')).toBeInTheDocument()
    expect(within(now).getByText('0 av 2')).toBeInTheDocument()
    act(() => pushRatings({ u1: { '2': { c1: 4 } }, u3: { '2': { c1: 5 } } }))
    expect(within(now).getByText('1 av 2')).toBeInTheDocument()
    expect(within(screen.getByRole('region', { name: 'Förbered härnäst' })).getByText('Nr 3 · Portvinsglögg')).toBeInTheDocument()
  })

  it('Servera skriver live/tasting för klassen och förbereder nästa', async () => {
    renderPanel({ stage: 'evening', tasting: { vanlig: { open: true, serving: 2, next: 3 } } })
    fireEvent.click(screen.getByRole('button', { name: /Servera nr 3/ }))
    expect(mocked.setTasting).toHaveBeenCalledWith('demo', 'vanlig', { serving: 3, next: null })
  })

  it('börjar med nr 1 innan något har serverats', () => {
    renderPanel({ stage: 'evening' })
    expect(within(screen.getByRole('region', { name: 'Serveras nu' })).getByText('Inget än')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /Servera nr 1/ }))
    expect(mocked.setTasting).toHaveBeenCalledWith('demo', 'vanlig', { serving: 1, next: 2 })
  })

  it('serveringsordningen visar status, och admin kan förbereda en annan glögg', () => {
    renderPanel({ stage: 'evening', tasting: { vanlig: { open: true, serving: 2, next: 3 } } })
    const order = screen.getByRole('region', { name: 'Serveringsordning' })
    const rows = within(order).getAllByRole('listitem')
    expect(rows.map((r) => r.textContent)).toEqual(['1Vit glöggServerad', '2Klassisk rödServeras nu', '3PortvinsglöggFörbered'])
    fireEvent.click(within(order).getByRole('button', { name: 'Förbered nr 1 härnäst' }))
    expect(mocked.setTasting).toHaveBeenCalledWith('demo', 'vanlig', { serving: 2, next: 1 })
  })

  it('säger till när alla är serverade', () => {
    renderPanel({ stage: 'evening', tasting: { vanlig: { open: true, serving: 3, next: null } } })
    expect(screen.getByText('Alla glögger i vanlig är serverade.')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Servera/ })).not.toBeInTheDocument()
  })

  it('styr klasserna var för sig', () => {
    renderPanel({ stage: 'evening', tasting: { vanlig: { open: true, serving: 2, next: 3 } } })
    fireEvent.click(screen.getByRole('tab', { name: /Alkoholfri/ }))
    fireEvent.click(screen.getByRole('button', { name: /Servera nr 1/ }))
    expect(mocked.setTasting).toHaveBeenCalledWith('demo', 'alkfri', { serving: 1, next: null })
  })
})
