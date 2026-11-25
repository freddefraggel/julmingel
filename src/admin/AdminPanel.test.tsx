import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { SignedInUser } from '../data'
import * as data from '../data'
import type { EventConfig, Guest, LiveState } from '../types'
import { AdminGate } from './AdminGate'
import AdminPanel from './AdminPanel'
import { guestUrl } from './guestUrl'

vi.mock('../data', () => ({
  onUserChanged: vi.fn(),
  signInAdmin: vi.fn(),
  signOut: vi.fn(),
  isWrongCredentials: (error: unknown) => (error as { code?: string }).code === 'auth/invalid-credential',
  openAdminEvent: vi.fn(),
  subscribeLive: vi.fn(),
  subscribeConfig: vi.fn(),
  subscribeGuests: vi.fn(),
  setPhase: vi.fn(),
  setJoinOpen: vi.fn(),
  changeGuestClass: vi.fn(),
  removeGuest: vi.fn(),
  subscribeNumbers: vi.fn(() => () => {}),
  subscribeAllRatings: vi.fn(() => () => {}),
  subscribeAssets: vi.fn(() => () => {}),
  setTasting: vi.fn(),
}))

const mocked = vi.mocked(data)
const admin: SignedInUser = { uid: 'admin', isAnonymous: false }

const guests: Record<string, Guest> = {
  u1: { name: 'Anna', class: 'vanlig', joinCode: 'glogg', joinedAt: 1 },
  u2: { name: 'Bertil', class: 'alkfri', joinCode: 'glogg', joinedAt: 2 },
  u3: { name: 'anna ', class: 'vanlig', joinCode: 'glogg', joinedAt: 3 },
}

function signedIn(user: SignedInUser | null) {
  mocked.onUserChanged.mockImplementation((callback) => {
    queueMicrotask(() => callback(user))
    return () => {}
  })
}

function eventData(live: LiveState | null, config: Partial<EventConfig> = {}) {
  mocked.openAdminEvent.mockResolvedValue({ ok: true, name: 'Glöggmingel (test)', joinCode: 'glogg' })
  mocked.subscribeLive.mockImplementation((_e, callback) => {
    callback(live)
    return () => {}
  })
  mocked.subscribeConfig.mockImplementation((_e, callback) => {
    callback({ name: 'Glöggmingel (test)', joinOpen: true, ...config })
    return () => {}
  })
  mocked.subscribeGuests.mockImplementation((_e, callback) => {
    callback(guests)
    return () => {}
  })
}

function renderAt(url: string) {
  render(
    <MemoryRouter initialEntries={[url]}>
      <AdminGate title="Styr kvällen">
        <AdminPanel />
      </AdminGate>
    </MemoryRouter>,
  )
}

beforeEach(() => {
  vi.resetAllMocks()
  localStorage.clear()
  for (const write of [mocked.setPhase, mocked.setJoinOpen, mocked.changeGuestClass, mocked.removeGuest]) {
    write.mockResolvedValue(undefined)
  }
})

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
})

describe('inloggning', () => {
  it('visar inloggningen när ingen är inloggad', async () => {
    signedIn(null)
    renderAt('/admin')
    expect(await screen.findByRole('button', { name: 'Logga in' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Styr kvällen' })).toBeInTheDocument()
    expect(mocked.openAdminEvent).not.toHaveBeenCalled()
  })

  it('räknar inte en anonym gästinloggning som admin', async () => {
    signedIn({ uid: 'gast', isAnonymous: true })
    renderAt('/admin')
    expect(await screen.findByRole('button', { name: 'Logga in' })).toBeInTheDocument()
  })

  it('loggar in med e-post och lösenord', async () => {
    signedIn(null)
    mocked.signInAdmin.mockResolvedValue(admin)
    renderAt('/admin')
    fireEvent.change(await screen.findByLabelText('E-post'), { target: { value: ' admin@julmingel.test ' } })
    fireEvent.change(screen.getByLabelText('Lösenord'), { target: { value: 'julmingel' } })
    fireEvent.click(screen.getByRole('button', { name: 'Logga in' }))
    await waitFor(() => expect(mocked.signInAdmin).toHaveBeenCalledWith('admin@julmingel.test', 'julmingel'))
  })

  it('säger till vid fel lösenord', async () => {
    signedIn(null)
    mocked.signInAdmin.mockRejectedValue(Object.assign(new Error('nej'), { code: 'auth/invalid-credential' }))
    renderAt('/admin')
    fireEvent.change(await screen.findByLabelText('E-post'), { target: { value: 'admin@julmingel.test' } })
    fireEvent.change(screen.getByLabelText('Lösenord'), { target: { value: 'fel' } })
    fireEvent.click(screen.getByRole('button', { name: 'Logga in' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('Fel e-post eller lösenord.')
  })
})

describe('välj kväll', () => {
  it('frågar efter kvällen och kommer ihåg den', async () => {
    signedIn(admin)
    eventData({ stage: 'lobby' })
    renderAt('/admin')
    fireEvent.change(await screen.findByLabelText('Vilken kväll vill du styra?'), { target: { value: 'demo' } })
    fireEvent.click(screen.getByRole('button', { name: 'Öppna' }))
    expect(await screen.findByRole('navigation', { name: 'Kvällens flöde' })).toBeInTheDocument()
    expect(mocked.openAdminEvent).toHaveBeenCalledWith('demo')
    expect(localStorage.getItem('julmingel.adminEvent')).toBe('demo')
  })

  it('säger till när kontot inte är admin', async () => {
    signedIn(admin)
    mocked.openAdminEvent.mockResolvedValue({ ok: false, reason: 'not-admin' })
    renderAt('/admin?e=demo')
    expect(await screen.findByRole('alert')).toHaveTextContent('Kontot har inte admin-behörighet')
  })

  it('säger till när kvällen inte finns', async () => {
    signedIn(admin)
    mocked.openAdminEvent.mockResolvedValue({ ok: false, reason: 'no-event' })
    renderAt('/admin?e=okand')
    expect(await screen.findByRole('alert')).toHaveTextContent('Det finns ingen kväll med id ”okand”.')
  })
})

describe('kontrollpanelen', () => {
  async function openPanel(live: LiveState | null = { stage: 'evening' }, config?: Partial<EventConfig>) {
    signedIn(admin)
    eventData(live, config)
    renderAt('/admin?e=demo')
    // Vänta tills alla tre prenumerationerna har levererat.
    await screen.findByText('3 gäster inne')
    await screen.findByText(/^Registreringen är /)
    return screen.getByRole('navigation', { name: 'Kvällens flöde' })
  }

  it('en ny kväll utan live/ går att starta', async () => {
    mocked.setPhase.mockResolvedValue()
    await openPanel(null)
    expect(screen.getByRole('heading', { name: 'Kvällen har inte börjat' })).toBeInTheDocument()
    const start = screen.getByRole('button', { name: 'Nästa: Registrering' })
    expect(start).toBeEnabled()
    fireEvent.click(start)
    await waitFor(() => expect(mocked.setPhase).toHaveBeenCalledWith('demo', 'registration'))
  })

  it('visar aktuell fas och byter fas med en skrivning', async () => {
    const flow = await openPanel()
    const tasting = within(flow).getByRole('button', { name: /Glöggprovning/ })
    expect(tasting).toHaveAttribute('aria-current', 'step')
    expect(within(flow).getAllByRole('button')).toHaveLength(7)

    fireEvent.click(within(flow).getByRole('button', { name: /Musikquiz/ }))
    await waitFor(() => expect(mocked.setPhase).toHaveBeenCalledWith('demo', 'quiz'))
    expect(mocked.setPhase).toHaveBeenCalledTimes(1)
  })

  it('går till nästa fas', async () => {
    await openPanel({ stage: 'lobby' })
    fireEvent.click(screen.getByRole('button', { name: 'Nästa: Glöggprovning' }))
    await waitFor(() => expect(mocked.setPhase).toHaveBeenCalledWith('demo', 'tasting'))
  })

  it('stänger och öppnar registreringen', async () => {
    await openPanel()
    fireEvent.click(screen.getByRole('button', { name: 'Stäng registreringen' }))
    await waitFor(() => expect(mocked.setJoinOpen).toHaveBeenCalledWith('demo', false))
  })

  it('visar antal gäster och märker möjliga dubbletter', async () => {
    await openPanel()
    expect(await screen.findByText('3 gäster inne')).toBeInTheDocument()
    expect(screen.getAllByText('Dubblett?')).toHaveLength(2)
    expect(screen.getByText('Vanlig 2')).toBeInTheDocument()
    expect(screen.getByText('Alkoholfri 1')).toBeInTheDocument()
  })

  it('byter klass efter bekräftelse', async () => {
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(true)
    await openPanel()
    fireEvent.change(screen.getByLabelText('Klass för Bertil'), { target: { value: 'vanlig' } })
    expect(confirm).toHaveBeenCalledWith(expect.stringContaining('Betyg som Bertil redan har satt tas bort'))
    await waitFor(() => expect(mocked.changeGuestClass).toHaveBeenCalledWith('demo', 'u2', 'vanlig'))
  })

  it('tar bort en dubblett efter bekräftelse, men inte om admin ångrar sig', async () => {
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(false)
    await openPanel()
    fireEvent.click(screen.getByRole('button', { name: 'Ta bort anna' }))
    expect(mocked.removeGuest).not.toHaveBeenCalled()

    confirm.mockReturnValue(true)
    fireEvent.click(screen.getByRole('button', { name: 'Ta bort anna' }))
    await waitFor(() => expect(mocked.removeGuest).toHaveBeenCalledWith('demo', 'u3'))
  })

  it('visar ett fel när en skrivning nekas', async () => {
    mocked.setPhase.mockRejectedValue(new Error('PERMISSION_DENIED'))
    const flow = await openPanel()
    fireEvent.click(within(flow).getByRole('button', { name: /Rättning/ }))
    expect(await screen.findByRole('alert')).toHaveTextContent('Kunde inte spara')
  })

  it('visar QR-koden med gästlänken', async () => {
    await openPanel()
    fireEvent.click(screen.getByRole('button', { name: 'Visa QR-kod' }))
    const dialog = screen.getByRole('dialog', { name: 'Skanna för att gå med' })
    const image = await within(dialog).findByRole('img')
    expect(image.getAttribute('src')).toMatch(/^data:image\/svg\+xml/)
    expect(within(dialog).getByText(/#\/\?e=demo&k=glogg$/)).toBeInTheDocument()
    fireEvent.click(within(dialog).getByRole('button', { name: 'Stäng' }))
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })
})

describe('gästlänken', () => {
  it('pekar på sajten med eventId och joinCode', () => {
    expect(guestUrl('demo', 'glögg 1', 'https://freddefraggel.github.io/julmingel/')).toBe(
      'https://freddefraggel.github.io/julmingel/#/?e=demo&k=gl%C3%B6gg+1',
    )
  })
})
