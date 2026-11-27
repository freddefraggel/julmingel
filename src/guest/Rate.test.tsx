import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import * as data from '../data'
import type { Criterion, EventConfig, Guest, GuestRatings, LiveState } from '../types'
import { GuestLive } from './GuestLive'
import { Rate } from './Rate'

vi.mock('../data', () => ({
  subscribeServerTimeOffset: vi.fn(() => () => {}),
  saveRatings: vi.fn(),
  subscribeLive: vi.fn(),
  subscribeConfig: vi.fn(),
  subscribeOwnGuest: vi.fn(),
  subscribeOwnRatings: vi.fn(),
  subscribeNotes: vi.fn(() => () => {}),
  saveNote: vi.fn(() => Promise.resolve()),
  getAssets: vi.fn(),
  subscribeReveal: vi.fn(() => () => {}),
  subscribeOwnAnswer: vi.fn(() => () => {}),
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

  it('sparar varje tryck direkt och bekräftar diskret, utan Spara-knapp', async () => {
    renderRate()
    expect(screen.queryByRole('button', { name: /Spara/ })).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Julkänsla 4' }))
    expect(screen.getByRole('button', { name: 'Julkänsla 4' })).toHaveAttribute('aria-pressed', 'true')
    expect(mocked.saveRatings).toHaveBeenLastCalledWith('demo', 'u1', '2', { c1: 4 })
    fireEvent.click(screen.getByRole('button', { name: 'Sliskighet 2' }))
    expect(mocked.saveRatings).toHaveBeenLastCalledWith('demo', 'u1', '2', { c2: 2 })
    expect(await screen.findByRole('status')).toHaveTextContent('Sparat ✓')
  })

  it('visar sparade betyg och rankade nummer', () => {
    const ratings: GuestRatings = { '1': { c1: 5 }, '2': { c1: 3, c2: 1 } }
    renderRate({ ratings })
    expect(screen.getByRole('button', { name: 'Glögg 1, rankad' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Julkänsla 3' })).toHaveAttribute('aria-pressed', 'true')
    fireEvent.click(screen.getByRole('button', { name: 'Julkänsla 5' }))
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
    expect(await screen.findByRole('alert')).toHaveTextContent('Kunde inte spara')
    // Trycket som inte kom fram visas inte som sparat.
    expect(screen.getByRole('button', { name: 'Julkänsla 4' })).toHaveAttribute('aria-pressed', 'false')
  })

  it('Tillbaka går till Hem', () => {
    const { onBack } = renderRate()
    fireEvent.click(screen.getByRole('button', { name: 'Tillbaka' }))
    expect(onBack).toHaveBeenCalled()
  })
})

describe('Egen anteckning', () => {
  beforeEach(() => {
    mocked.saveNote.mockResolvedValue()
    vi.useFakeTimers()
  })
  afterEach(() => {
    vi.useRealTimers()
  })

  const field = () => screen.getByRole('textbox', { name: /Egen anteckning/ })

  it('sparas 600 ms efter senaste tangenttryck, inte före', async () => {
    renderRate()
    expect(field()).toHaveAttribute('placeholder', 'kanel, för söt …')
    fireEvent.change(field(), { target: { value: 'kan' } })
    act(() => vi.advanceTimersByTime(400))
    fireEvent.change(field(), { target: { value: 'kanel' } })
    act(() => vi.advanceTimersByTime(599))
    expect(mocked.saveNote).not.toHaveBeenCalled()
    await act(async () => vi.advanceTimersByTime(1))
    expect(mocked.saveNote).toHaveBeenCalledTimes(1)
    expect(mocked.saveNote).toHaveBeenCalledWith('demo', 'u1', '2', 'kanel')
    expect(screen.getByRole('status')).toHaveTextContent('Sparat ✓')
  })

  it('sparas direkt när fältet tappar fokus', async () => {
    renderRate()
    fireEvent.change(field(), { target: { value: 'för söt' } })
    await act(async () => fireEvent.blur(field()))
    expect(mocked.saveNote).toHaveBeenCalledWith('demo', 'u1', '2', 'för söt')
    // Ingen dubbel sparning när timern skulle ha gått.
    await act(async () => vi.advanceTimersByTime(1_000))
    expect(mocked.saveNote).toHaveBeenCalledTimes(1)
  })

  it('tom text sparas som tom, så att anteckningen tas bort', async () => {
    renderRate({ notes: { '2': 'kanel' } })
    fireEvent.change(field(), { target: { value: '' } })
    await act(async () => vi.advanceTimersByTime(600))
    expect(mocked.saveNote).toHaveBeenCalledWith('demo', 'u1', '2', '')
  })

  it('visar den sparade anteckningen för varje nummer', () => {
    renderRate({ notes: { '2': 'kanel', '3': 'för söt' } })
    expect(field()).toHaveValue('kanel')
    fireEvent.click(screen.getByRole('button', { name: /^Glögg 3/ }))
    expect(field()).toHaveValue('för söt')
    fireEvent.click(screen.getByRole('button', { name: /^Glögg 4/ }))
    expect(field()).toHaveValue('')
  })

  it('max 500 tecken, med räknare från 400', () => {
    renderRate()
    expect(field()).toHaveAttribute('maxLength', '500')
    fireEvent.change(field(), { target: { value: 'x'.repeat(399) } })
    expect(screen.queryByText(/\/ 500/)).not.toBeInTheDocument()
    fireEvent.change(field(), { target: { value: 'x'.repeat(420) } })
    expect(screen.getByText('420 / 500')).toBeInTheDocument()
  })

  it('en väntande anteckning sparas när gästen lämnar sidan', () => {
    const { unmount } = renderRate()
    fireEvent.change(field(), { target: { value: 'kanel' } })
    unmount()
    expect(mocked.saveNote).toHaveBeenCalledWith('demo', 'u1', '2', 'kanel')
  })

  it('stängd provning: anteckningen syns men går inte att ändra, och inget fält utan anteckning', () => {
    const { rerender } = renderRate({ open: false, notes: { '2': 'kanel' } })
    expect(field()).toHaveValue('kanel')
    expect(field()).toHaveAttribute('readonly')
    rerender(<Rate eventId="demo" uid="u1" count={4} criteria={criteria} ratings={{}} serving={2} open={false} notes={{}} onBack={() => {}} />)
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument()
  })

  it('säger till när anteckningen inte kan sparas', async () => {
    mocked.saveNote.mockRejectedValue(new Error('PERMISSION_DENIED'))
    renderRate()
    fireEvent.change(field(), { target: { value: 'kanel' } })
    await act(async () => vi.advanceTimersByTime(600))
    expect(screen.getByRole('alert')).toHaveTextContent('Kunde inte spara anteckningen')
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
    act(() => pushLive({ stage: 'evening', tasting: { vanlig: { open: true, serving: null, next: null } } }))
    fireEvent.click(screen.getByRole('button', { name: /Ranka glögg/ }))
    expect(screen.getByRole('heading', { name: 'Glögg nr 1' })).toBeInTheDocument()
    expect(screen.getAllByRole('button', { name: /^Glögg \d/ })).toHaveLength(2)
    fireEvent.click(screen.getByRole('button', { name: 'Tillbaka' }))
    expect(screen.getByRole('heading', { name: 'Hej Anna!' })).toBeInTheDocument()
  })

  it('mobilen hoppar till glöggen som serveras i gästens klass', () => {
    render(<GuestLive eventId="demo" uid="u1" guest={anna} />)
    act(() => pushLive({ stage: 'evening', tasting: { alkfri: { open: true, serving: 1, next: null } } }))
    expect(screen.getByRole('heading', { name: 'Hej Anna!' })).toBeInTheDocument()
    act(() => pushLive({ stage: 'evening', tasting: { vanlig: { open: true, serving: 2, next: null } } }))
    expect(screen.getByRole('heading', { name: 'Glögg nr 2' })).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Tillbaka' }))
    // Samma glögg serveras fortfarande: gästen får stanna på Hem.
    act(() => pushLive({ stage: 'evening', answered: { qId: 'q0', count: 0, total: 0 }, tasting: { vanlig: { open: true, serving: 2, next: null } } }))
    expect(screen.getByRole('heading', { name: 'Hej Anna!' })).toBeInTheDocument()
  })

  it('lämnar Ranka glögg när provningen är slut', () => {
    render(<GuestLive eventId="demo" uid="u1" guest={anna} />)
    act(() => pushLive({ stage: 'evening', tasting: { vanlig: { open: true, serving: 1, next: 2 } } }))
    expect(screen.getByRole('heading', { name: 'Glögg nr 1' })).toBeInTheDocument()
    act(() => pushLive({ stage: 'wrapup', wrapup: { step: 'review' }, tasting: { vanlig: { open: false, serving: 1, next: 2 } } }))
    expect(screen.queryByRole('heading', { name: 'Glögg nr 1' })).not.toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Rättningen börjar snart' })).toBeInTheDocument()
  })
})
