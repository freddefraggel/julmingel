import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import * as data from '../data'
import type { Criterion, EventConfig, Guest, GuestRatings, LiveState } from '../types'
import { GuestLive } from './GuestLive'
import { Rate } from './Rate'

vi.mock('../data', () => ({
  saveRatings: vi.fn(),
  subscribeLive: vi.fn(),
  subscribeConfig: vi.fn(),
  subscribeOwnGuest: vi.fn(),
  subscribeOwnRatings: vi.fn(),
  getAssets: vi.fn(),
}))

const mocked = vi.mocked(data)

const criteria: Record<string, Criterion> = {
  c2: { name: 'Sliskighet', order: 2, lowIsGood: true },
  c1: { name: 'Julkänsla', order: 1, lowIsGood: false },
}

function renderRate(props: Partial<Parameters<typeof Rate>[0]> = {}) {
  const onBack = vi.fn()
  const result = render(
    <Rate eventId="demo" uid="u1" count={4} criteria={criteria} ratings={{}} serving={2} onBack={onBack} {...props} />,
  )
  return { onBack, ...result }
}

beforeEach(() => {
  vi.resetAllMocks()
  mocked.saveRatings.mockResolvedValue()
})

afterEach(cleanup)

describe('Ranka glögg', () => {
  it('öppnar på numret som serveras och visar kriterierna i ordning', () => {
    renderRate()
    expect(screen.getByRole('heading', { name: 'Glögg nr 2' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Glögg 2, serveras nu' })).toHaveAttribute('aria-pressed', 'true')
    const legends = screen.getAllByRole('group').map((g) => g.querySelector('legend')!.textContent)
    expect(legends).toEqual(['Julkänsla', 'Sliskighetlågt = bra'])
  })

  it('sparar betygen för numret i ett anrop och kvitterar', async () => {
    renderRate()
    expect(screen.getByRole('button', { name: 'Spara betyg' })).toBeDisabled()
    fireEvent.click(screen.getByRole('button', { name: 'Julkänsla 4' }))
    fireEvent.click(screen.getByRole('button', { name: 'Sliskighet 2' }))
    expect(screen.getByRole('button', { name: 'Julkänsla 4' })).toHaveAttribute('aria-pressed', 'true')
    fireEvent.click(screen.getByRole('button', { name: 'Spara betyg' }))
    expect(await screen.findByRole('status')).toHaveTextContent('Sparat! Dina betyg på glögg 2 är med.')
    expect(mocked.saveRatings).toHaveBeenCalledWith('demo', 'u1', '2', { c1: 4, c2: 2 })
  })

  it('visar sparade betyg och rankade nummer', () => {
    const ratings: GuestRatings = { '1': { c1: 5 }, '2': { c1: 3, c2: 1 } }
    renderRate({ ratings })
    expect(screen.getByRole('button', { name: 'Glögg 1, rankad' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Julkänsla 3' })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByRole('button', { name: 'Sparat – ändra och spara igen' })).toBeDisabled()
    fireEvent.click(screen.getByRole('button', { name: 'Julkänsla 5' }))
    fireEvent.click(screen.getByRole('button', { name: 'Uppdatera betyg' }))
    expect(mocked.saveRatings).toHaveBeenCalledWith('demo', 'u1', '2', { c1: 5 })
  })

  it('gästen kan gå tillbaka till ett annat nummer utan att tappa osparade betyg', () => {
    renderRate()
    fireEvent.click(screen.getByRole('button', { name: 'Julkänsla 2' }))
    fireEvent.click(screen.getByRole('button', { name: 'Glögg 1' }))
    expect(screen.getByRole('heading', { name: 'Glögg nr 1' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Julkänsla 2' })).toHaveAttribute('aria-pressed', 'false')
    fireEvent.click(screen.getByRole('button', { name: /Glögg 2/ }))
    expect(screen.getByRole('button', { name: 'Julkänsla 2' })).toHaveAttribute('aria-pressed', 'true')
  })

  it('hoppar till nästa glögg när värden serverar den', () => {
    const { rerender } = renderRate()
    fireEvent.click(screen.getByRole('button', { name: 'Glögg 1' }))
    rerender(<Rate eventId="demo" uid="u1" count={4} criteria={criteria} ratings={{}} serving={3} onBack={() => {}} />)
    expect(screen.getByRole('heading', { name: 'Glögg nr 3' })).toBeInTheDocument()
  })

  it('säger till när sparandet nekas', async () => {
    mocked.saveRatings.mockRejectedValue(new Error('permission_denied'))
    renderRate()
    fireEvent.click(screen.getByRole('button', { name: 'Julkänsla 4' }))
    fireEvent.click(screen.getByRole('button', { name: 'Spara betyg' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('Kunde inte spara')
  })

  it('Tillbaka går till Hem', () => {
    const { onBack } = renderRate()
    fireEvent.click(screen.getByRole('button', { name: 'Tillbaka' }))
    expect(onBack).toHaveBeenCalled()
  })
})

describe('Ranka glögg i kvällens flöde', () => {
  const anna: Guest = { name: 'Anna', class: 'vanlig', joinCode: 'k', joinedAt: 1 }
  const config: EventConfig = {
    name: 'Test',
    joinOpen: true,
    criteria,
    gloggs: {
      g1: { class: 'vanlig', name: 'A', description: '' },
      g2: { class: 'vanlig', name: 'B', description: '' },
      g3: { class: 'alkfri', name: 'C', description: '' },
    },
  }
  let pushLive: (live: LiveState | null) => void

  beforeEach(() => {
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
  })

  it('Hem öppnar Ranka glögg, och Tillbaka går till Hem', () => {
    render(<GuestLive eventId="demo" uid="u1" guest={anna} />)
    act(() => pushLive({ phase: 'tasting' }))
    fireEvent.click(screen.getByRole('button', { name: /Ranka glögg/ }))
    expect(screen.getByRole('heading', { name: 'Glögg nr 1' })).toBeInTheDocument()
    expect(screen.getAllByRole('button', { name: /^Glögg \d/ })).toHaveLength(2)
    fireEvent.click(screen.getByRole('button', { name: 'Tillbaka' }))
    expect(screen.getByRole('heading', { name: 'Hej Anna!' })).toBeInTheDocument()
  })

  it('mobilen hoppar till glöggen som serveras i gästens klass', () => {
    render(<GuestLive eventId="demo" uid="u1" guest={anna} />)
    act(() => pushLive({ phase: 'tasting', tasting: { alkfri: { serving: 1, next: null } } }))
    expect(screen.getByRole('heading', { name: 'Hej Anna!' })).toBeInTheDocument()
    act(() => pushLive({ phase: 'tasting', tasting: { vanlig: { serving: 2, next: null } } }))
    expect(screen.getByRole('heading', { name: 'Glögg nr 2' })).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Tillbaka' }))
    // Samma glögg serveras fortfarande: gästen får stanna på Hem.
    act(() => pushLive({ phase: 'tasting', nowText: 'Paus', tasting: { vanlig: { serving: 2, next: null } } }))
    expect(screen.getByRole('heading', { name: 'Hej Anna!' })).toBeInTheDocument()
  })

  it('går tillbaka till Hem när provningen är slut', () => {
    render(<GuestLive eventId="demo" uid="u1" guest={anna} />)
    act(() => pushLive({ phase: 'tasting', tasting: { vanlig: { serving: 1, next: 2 } } }))
    expect(screen.getByRole('heading', { name: 'Glögg nr 1' })).toBeInTheDocument()
    act(() => pushLive({ phase: 'quiz', tasting: { vanlig: { serving: 1, next: 2 } } }))
    expect(screen.getByRole('heading', { name: 'Hej Anna!' })).toBeInTheDocument()
  })
})
