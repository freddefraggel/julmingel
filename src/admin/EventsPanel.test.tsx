import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import * as data from '../data'
import type { EventConfig } from '../types'
import { createChanges, idProblem, newEventProblems, sortedEvents, suggestId, type EventIndexEntry } from './events'
import { EventsPanel } from './EventsPanel'

vi.mock('../data', () => ({
  subscribeEventIndex: vi.fn(),
  eventExists: vi.fn(),
  createEvent: vi.fn(),
  signOut: vi.fn(),
}))

const mocked = vi.mocked(data)
let pushIndex: (index: Record<string, EventIndexEntry>) => void
const onChoose = vi.fn()

function renderPanel() {
  render(
    <MemoryRouter>
      <EventsPanel onChoose={onChoose} />
    </MemoryRouter>,
  )
}

beforeEach(() => {
  vi.clearAllMocks()
  mocked.subscribeEventIndex.mockImplementation((callback) => {
    pushIndex = callback
    callback({
      glogg2026: { name: 'Gröna Villans Glöggmingel 2026', updatedAt: 2 },
      demo: { name: 'Testkväll', updatedAt: 1 },
    })
    return () => {}
  })
  mocked.eventExists.mockResolvedValue(false)
  mocked.createEvent.mockResolvedValue()
})

afterEach(cleanup)

describe('Kvällar', () => {
  it('listar kvällarna, senast använda först, med Styr kvällen och Förbered', () => {
    renderPanel()
    const rows = within(screen.getByRole('list')).getAllByRole('listitem')
    expect(rows.map((r) => r.querySelector('strong')!.textContent)).toEqual(['Gröna Villans Glöggmingel 2026', 'Testkväll'])
    fireEvent.click(within(rows[0]!).getByRole('button', { name: 'Styr kvällen' }))
    expect(onChoose).toHaveBeenCalledWith('glogg2026')
    expect(within(rows[1]!).getByRole('link', { name: 'Förbered' })).toHaveAttribute('href', '/admin/forbered?e=demo')
  })

  it('öppnar en kväll med id som inte finns i listan än', () => {
    renderPanel()
    fireEvent.change(screen.getByLabelText('Öppna kväll med id'), { target: { value: 'gammal' } })
    fireEvent.click(screen.getByRole('button', { name: 'Öppna' }))
    expect(onChoose).toHaveBeenCalledWith('gammal')
  })

  it('skapar en ny kväll med id från namnet och öppnar den', async () => {
    renderPanel()
    fireEvent.change(screen.getByLabelText('Namn'), { target: { value: 'Glöggmingel 2027' } })
    expect(screen.getByLabelText('Id i adressen')).toHaveValue('gloggmingel-2027')
    fireEvent.change(screen.getByLabelText('Kod i QR-länken'), { target: { value: 'tomte' } })
    fireEvent.click(screen.getByRole('button', { name: 'Skapa kvällen' }))
    await waitFor(() => expect(onChoose).toHaveBeenCalledWith('gloggmingel-2027'))
    expect(mocked.createEvent).toHaveBeenCalledWith({ eventId: 'gloggmingel-2027', name: 'Glöggmingel 2027', joinCode: 'tomte' }, null)
  })

  it('kopierar från en annan kväll när admin väljer det', async () => {
    renderPanel()
    fireEvent.change(screen.getByLabelText('Namn'), { target: { value: 'Test' } })
    fireEvent.change(screen.getByLabelText('Id i adressen'), { target: { value: 'test' } })
    fireEvent.change(screen.getByLabelText('Kod i QR-länken'), { target: { value: 'kod' } })
    fireEvent.change(screen.getByLabelText('Kopiera från'), { target: { value: 'glogg2026' } })
    expect(screen.getByText(/Gäster, betyg, svar och resultat följer inte med/)).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Skapa kvällen' }))
    await waitFor(() => expect(mocked.createEvent).toHaveBeenCalledWith({ eventId: 'test', name: 'Test', joinCode: 'kod' }, 'glogg2026'))
  })

  it('säger till när id:t redan finns eller något saknas', async () => {
    mocked.eventExists.mockResolvedValue(true)
    renderPanel()
    fireEvent.click(screen.getByRole('button', { name: 'Skapa kvällen' }))
    expect(screen.getByRole('alert')).toHaveTextContent('Kvällen behöver ett namn.')
    fireEvent.change(screen.getByLabelText('Namn'), { target: { value: 'Test' } })
    fireEvent.change(screen.getByLabelText('Id i adressen'), { target: { value: 'demo' } })
    fireEvent.change(screen.getByLabelText('Kod i QR-länken'), { target: { value: 'kod' } })
    fireEvent.click(screen.getByRole('button', { name: 'Skapa kvällen' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('Det finns redan en kväll med id ”demo”.')
    expect(mocked.createEvent).not.toHaveBeenCalled()
  })

  it('visar en tom lista med en hjälptext', () => {
    renderPanel()
    act(() => pushIndex({}))
    expect(screen.getByText(/Inga kvällar än/)).toBeInTheDocument()
  })
})

describe('events.ts', () => {
  it('idProblem och suggestId', () => {
    expect(idProblem('glogg2026')).toBeNull()
    expect(idProblem('Glögg 2026')).not.toBeNull()
    expect(idProblem('a')).not.toBeNull()
    expect(suggestId('Gröna Villans Glöggmingel 2026!')).toBe('grona-villans-gloggmingel-2026')
  })

  it('newEventProblems', () => {
    expect(newEventProblems({ eventId: 'test', name: 'Test', joinCode: 'kod' }, false)).toEqual([])
    expect(newEventProblems({ eventId: 'test', name: 'Test', joinCode: 'två ord' }, false)).toEqual([
      'Koden får inte innehålla mellanslag.',
    ])
  })

  it('createChanges utan källa: namn, stängd registrering, kod och registret', () => {
    expect(createChanges({ eventId: 'test', name: ' Test ', joinCode: ' kod ' }, null, 5)).toEqual({
      'events/test/config': { name: 'Test', joinOpen: false },
      'events/test/secret': { joinCode: 'kod' },
      'eventIndex/test': { name: 'Test', updatedAt: 5 },
    })
  })

  it('createChanges med källa: förberedelserna följer med, men nytt namn, ny kod och stängd registrering', () => {
    const config = {
      name: 'Gammal',
      joinOpen: true,
      criteria: { c1: { name: 'Smak', order: 1, lowIsGood: false } },
      gloggs: { g1: { class: 'vanlig', name: 'Röd', description: '', imageId: 'i1' } },
    } as EventConfig
    const changes = createChanges(
      { eventId: 'ny', name: 'Ny', joinCode: 'ny-kod' },
      { config, assets: { i1: 'data:image/webp;base64,AAA' }, numbers: { vanlig: { '1': 'g1' } }, correct: { q1: 'A' } },
      5,
    )
    expect(changes['events/ny/config']).toEqual({ ...config, name: 'Ny', joinOpen: false })
    expect(changes['events/ny/secret']).toEqual({ joinCode: 'ny-kod', numbers: { vanlig: { '1': 'g1' } }, correct: { q1: 'A' } })
    expect(changes['events/ny/assets']).toEqual({ i1: 'data:image/webp;base64,AAA' })
    expect(Object.keys(changes).some((k) => /guests|ratings|answers|results|live/.test(k))).toBe(false)
  })

  it('sortedEvents', () => {
    expect(sortedEvents({ b: { name: 'B' }, a: { name: 'A', updatedAt: 3 } }).map((e) => e.eventId)).toEqual(['a', 'b'])
  })
})
