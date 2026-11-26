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
  touchEventIndex: vi.fn(() => Promise.resolve()),
  subscribeEventIndex: vi.fn(() => () => {}),
  createEvent: vi.fn(),
  eventExists: vi.fn(),
  subscribeLive: vi.fn(),
  subscribeConfig: vi.fn(),
  subscribeGuests: vi.fn(),
  setStage: vi.fn(),
  setWrapupStep: vi.fn(),
  setJoinOpen: vi.fn(),
  changeGuestClass: vi.fn(),
  removeGuest: vi.fn(),
  subscribeNumbers: vi.fn(() => () => {}),
  subscribeAllRatings: vi.fn(() => () => {}),
  subscribeAssets: vi.fn(() => () => {}),
  setTasting: vi.fn(),
  setTastingOpen: vi.fn(),
  subscribeCorrect: vi.fn(() => () => {}),
  subscribeServerTimeOffset: vi.fn(() => () => {}),
  subscribeAnswers: vi.fn(() => () => {}),
  subscribeReveal: vi.fn(() => () => {}),
  subscribeAllGuesses: vi.fn(() => () => {}),
  showReview: vi.fn(),
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
  for (const write of [mocked.setStage, mocked.setWrapupStep, mocked.setJoinOpen, mocked.changeGuestClass, mocked.removeGuest]) {
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
    fireEvent.change(await screen.findByLabelText('Öppna kväll med id'), { target: { value: 'demo' } })
    fireEvent.click(screen.getByRole('button', { name: 'Öppna' }))
    expect(await screen.findByRole('group', { name: 'Kvällens läge' })).toBeInTheDocument()
    expect(mocked.openAdminEvent).toHaveBeenCalledWith('demo')
    expect(localStorage.getItem('julmingel.adminEvent')).toBe('demo')
  })

  it('lägger kvällen i registret när den öppnas', async () => {
    signedIn(admin)
    eventData({ stage: 'lobby' })
    renderAt('/admin?e=demo')
    await screen.findByRole('group', { name: 'Kvällens läge' })
    expect(mocked.touchEventIndex).toHaveBeenCalledWith('demo', 'Glöggmingel (test)')
  })

  it('Alla kvällar går tillbaka till listan', async () => {
    signedIn(admin)
    eventData({ stage: 'lobby' })
    renderAt('/admin?e=demo')
    fireEvent.click(await screen.findByRole('button', { name: 'Alla kvällar' }))
    expect(await screen.findByRole('heading', { name: 'Kvällar' })).toBeInTheDocument()
    expect(localStorage.getItem('julmingel.adminEvent')).toBeNull()
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
  async function openPanel(live: LiveState | null = { stage: 'lobby' }, config?: Partial<EventConfig>) {
    signedIn(admin)
    eventData(live, config)
    renderAt('/admin?e=demo')
    // Vänta tills alla tre prenumerationerna har levererat.
    await screen.findByText('3 gäster')
    return screen.getByRole('group', { name: 'Kvällens läge' })
  }

  it('visar kvällens tre lägen överst, med det aktuella markerat', async () => {
    const stages = await openPanel({ stage: 'evening' })
    const buttons = within(stages).getAllByRole('button')
    expect(buttons.map((b) => b.textContent)).toEqual(['Innan start ✓', 'Kvällen pågår', 'Rättning och avslöjande'])
    expect(within(stages).getByRole('button', { name: 'Kvällen pågår' })).toHaveAttribute('aria-pressed', 'true')
  })

  it('en ny kväll utan live/ går att starta', async () => {
    await openPanel(null)
    expect(screen.getByText('Kvällen har inte börjat')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Starta kvällen' }))
    await waitFor(() => expect(mocked.setStage).toHaveBeenCalledWith('demo', 'evening', null))
  })

  it('under kvällen visas Glöggprovning och Musikquiz sida vid sida', async () => {
    await openPanel({ stage: 'evening' }, { songs: {}, questions: {} })
    expect(screen.getByRole('region', { name: 'Glöggprovning' })).toBeInTheDocument()
    expect(screen.getByRole('region', { name: 'Musikquiz' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Glöggprovning' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Musikquiz' })).toBeInTheDocument()
  })

  it('byter läge med en skrivning, och skickar med live/ så att rättningen kan stänga det som pågår', async () => {
    const live: LiveState = { stage: 'evening', quiz: { state: 'playing', songId: 's1', qId: 'q1' } }
    const stages = await openPanel(live)
    fireEvent.click(within(stages).getByRole('button', { name: 'Rättning och avslöjande' }))
    await waitFor(() => expect(mocked.setStage).toHaveBeenCalledWith('demo', 'wrapup', live))
    expect(mocked.setStage).toHaveBeenCalledTimes(1)
  })

  it('rättning och avslöjande har flikar för stegen, och Klart', async () => {
    await openPanel({ stage: 'wrapup', wrapup: { step: 'guess' } })
    const tabs = screen.getByRole('tablist', { name: 'Rättning och avslöjande' })
    expect(within(tabs).getByRole('tab', { name: 'Gissa glöggen' })).toHaveAttribute('aria-selected', 'true')
    fireEvent.click(within(tabs).getByRole('tab', { name: 'Avslöjande' }))
    await waitFor(() => expect(mocked.setWrapupStep).toHaveBeenCalledWith('demo', 'reveal'))
    fireEvent.click(within(tabs).getByRole('tab', { name: 'Klart' }))
    await waitFor(() => expect(mocked.setWrapupStep).toHaveBeenCalledWith('demo', 'done'))
  })

  it('klart markeras under Rättning och avslöjande', async () => {
    const stages = await openPanel({ stage: 'done' })
    expect(within(stages).getByRole('button', { name: 'Rättning och avslöjande' })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByRole('tab', { name: 'Klart' })).toHaveAttribute('aria-selected', 'true')
    expect(screen.getByText(/Kvällen är klar/)).toBeInTheDocument()
  })

  it('stänger och öppnar registreringen', async () => {
    await openPanel()
    fireEvent.click(screen.getByRole('button', { name: 'Stäng registreringen' }))
    await waitFor(() => expect(mocked.setJoinOpen).toHaveBeenCalledWith('demo', false))
  })

  it('visar antal gäster och märker möjliga dubbletter', async () => {
    await openPanel()
    expect(screen.getAllByText('Dubblett?')).toHaveLength(2)
    expect(screen.getByText('Vanlig 2')).toBeInTheDocument()
    expect(screen.getByText('Alkoholfri 1')).toBeInTheDocument()
  })

  it('gästlistan finns kvar under kvällen, i en ruta som fälls ut', async () => {
    await openPanel({ stage: 'evening' }, { songs: {}, questions: {} })
    expect(screen.getByText('Gäster · 3')).toBeInTheDocument()
    expect(screen.getByLabelText('Klass för Bertil')).toBeInTheDocument()
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
    mocked.setStage.mockRejectedValue(new Error('PERMISSION_DENIED'))
    const stages = await openPanel()
    fireEvent.click(within(stages).getByRole('button', { name: 'Kvällen pågår' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('Kunde inte spara')
  })

  it('Visa QR öppnar välkomstskärmen', async () => {
    await openPanel()
    expect(screen.getByRole('link', { name: 'Visa QR' })).toHaveAttribute('href', '/admin/qr')
  })

  it('påminner om att hålla registreringen öppen, eftersom en utskriven kod slutar fungera', async () => {
    await openPanel()
    expect(screen.getByText(/en utskriven kod slutar fungera när registreringen stängs/)).toBeInTheDocument()
  })
})

describe('gästlänken', () => {
  it('pekar på sajten med eventId och joinCode', () => {
    expect(guestUrl('demo', 'glögg 1', 'https://freddefraggel.github.io/julmingel/')).toBe(
      'https://freddefraggel.github.io/julmingel/#/?e=demo&k=gl%C3%B6gg+1',
    )
  })
})
