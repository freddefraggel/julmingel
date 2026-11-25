import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { SignedInUser } from '../data'
import * as data from '../data'
import type { Guest } from '../types'
import GuestApp from './GuestApp'

vi.mock('../data', () => ({
  subscribeServerTimeOffset: vi.fn(() => () => {}),
  subscribeOwnAnswer: vi.fn(() => () => {}),
  onUserChanged: vi.fn(),
  getOwnGuest: vi.fn(),
  signInGuest: vi.fn(),
  joinEvent: vi.fn(),
  subscribeLive: vi.fn(),
  subscribeConfig: vi.fn(),
  subscribeOwnGuest: vi.fn(),
  subscribeOwnRatings: vi.fn(),
  getAssets: vi.fn(),
}))

const mocked = vi.mocked(data)
const anna: Guest = { name: 'Anna', class: 'vanlig', joinCode: 'glogg', joinedAt: 1 }

/** Mobilen har (user) eller har inte (null) en inloggad Firebase-användare sedan tidigare. */
function signedIn(user: SignedInUser | null) {
  mocked.onUserChanged.mockImplementation((callback) => {
    queueMicrotask(() => callback(user))
    return () => {}
  })
}

function renderAt(url: string) {
  render(
    <MemoryRouter initialEntries={[url]}>
      <GuestApp />
    </MemoryRouter>,
  )
}

beforeEach(() => {
  vi.resetAllMocks()
  localStorage.clear()
  mocked.signInGuest.mockResolvedValue({ uid: 'u1', isAnonymous: true })
  // Hem prenumererar på live/, config/ och gästens egna noder; här svarar de aldrig.
  for (const subscribe of [
    mocked.subscribeLive,
    mocked.subscribeConfig,
    mocked.subscribeOwnGuest,
    mocked.subscribeOwnRatings,
  ] as ReturnType<typeof vi.fn>[]) {
    subscribe.mockReturnValue(() => {})
  }
  mocked.getAssets.mockResolvedValue({})
})

afterEach(cleanup)

describe('gästlänken', () => {
  it('ber om QR-koden när länken saknas', () => {
    renderAt('/')
    expect(screen.getByText(/Skanna QR-koden hos värden/)).toBeInTheDocument()
    expect(mocked.onUserChanged).not.toHaveBeenCalled()
  })

  it('läser eventId och joinCode från länken och kommer ihåg kvällen', async () => {
    signedIn(null)
    renderAt('/?e=demo&k=glogg')
    expect(await screen.findByRole('heading', { name: 'Välkommen in i värmen' })).toBeInTheDocument()
    expect(JSON.parse(localStorage.getItem('julmingel.guestLink')!)).toEqual({ eventId: 'demo', joinCode: 'glogg' })
  })

  it('säger till när koden saknas i länken', async () => {
    signedIn(null)
    renderAt('/?e=demo')
    expect(await screen.findByText(/Länken saknar kvällens kod/)).toBeInTheDocument()
  })
})

describe('återvändande gäst', () => {
  it('hoppar direkt till Hem', async () => {
    signedIn({ uid: 'u1', isAnonymous: true })
    mocked.getOwnGuest.mockResolvedValue(anna)
    renderAt('/?e=demo&k=glogg')
    expect(await screen.findByRole('heading', { name: 'Hej Anna!' })).toBeInTheDocument()
    expect(mocked.getOwnGuest).toHaveBeenCalledWith('demo', 'u1')
    // Prenumerationerna startas i en effekt efter att Hem har ritats; vänta in den.
    await waitFor(() =>
      expect(mocked.subscribeOwnRatings).toHaveBeenCalledWith('demo', 'u1', expect.any(Function), expect.any(Function)),
    )
  })

  it('hittar tillbaka till kvällen utan länk', async () => {
    localStorage.setItem('julmingel.guestLink', JSON.stringify({ eventId: 'demo', joinCode: 'glogg' }))
    signedIn({ uid: 'u1', isAnonymous: true })
    mocked.getOwnGuest.mockResolvedValue(anna)
    renderAt('/')
    expect(await screen.findByRole('heading', { name: 'Hej Anna!' })).toBeInTheDocument()
  })

  it('visar registreringen om inloggad användare inte gått med', async () => {
    signedIn({ uid: 'u1', isAnonymous: true })
    mocked.getOwnGuest.mockResolvedValue(null)
    renderAt('/?e=demo&k=glogg')
    expect(await screen.findByRole('heading', { name: 'Välkommen in i värmen' })).toBeInTheDocument()
  })
})

describe('registrering', () => {
  async function fillIn(name: string) {
    signedIn(null)
    renderAt('/?e=demo&k=glogg')
    fireEvent.change(await screen.findByLabelText('Ditt namn'), { target: { value: name } })
  }

  it('går med med namn och klass och visar Hem', async () => {
    mocked.joinEvent.mockResolvedValue({ ok: true, guest: { ...anna, class: 'alkfri' } })
    await fillIn('  Anna  ')
    fireEvent.click(screen.getByLabelText('Alkoholfri'))
    fireEvent.click(screen.getByRole('button', { name: 'Gå med' }))

    expect(await screen.findByRole('heading', { name: 'Hej Anna!' })).toBeInTheDocument()
    expect(mocked.joinEvent).toHaveBeenCalledWith('demo', 'u1', { name: 'Anna', class: 'alkfri', joinCode: 'glogg' })
    await waitFor(() =>
      expect(mocked.subscribeOwnGuest).toHaveBeenCalledWith('demo', 'u1', expect.any(Function), expect.any(Function)),
    )
    expect(mocked.getAssets).toHaveBeenCalledTimes(1)
  })

  it('kräver ett namn', async () => {
    await fillIn('   ')
    fireEvent.click(screen.getByRole('button', { name: 'Gå med' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('Skriv ditt namn')
    expect(mocked.signInGuest).not.toHaveBeenCalled()
  })

  it('säger till när registreringen är stängd', async () => {
    mocked.joinEvent.mockResolvedValue({ ok: false, reason: 'closed' })
    await fillIn('Anna')
    fireEvent.click(screen.getByRole('button', { name: 'Gå med' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('Registreringen är stängd')
  })

  it('säger till när koden är fel', async () => {
    mocked.joinEvent.mockResolvedValue({ ok: false, reason: 'wrong-code' })
    await fillIn('Anna')
    fireEvent.click(screen.getByRole('button', { name: 'Gå med' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('Koden i länken stämmer inte')
    expect(screen.getByRole('button', { name: 'Gå med' })).toBeEnabled()
  })

  it('säger till när nätet krånglar', async () => {
    mocked.signInGuest.mockRejectedValue(new Error('offline'))
    await fillIn('Anna')
    fireEvent.click(screen.getByRole('button', { name: 'Gå med' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('Något gick fel')
  })
})
