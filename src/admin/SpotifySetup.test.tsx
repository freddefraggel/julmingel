import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import * as spotify from '../spotify'
import type { SpotifyDevice } from '../spotify'
import { SpotifySetup } from './SpotifySetup'

vi.mock('../spotify', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../spotify')>()),
  getDevices: vi.fn(),
  isLoggedIn: vi.fn(() => true),
  takeLoginError: vi.fn(() => null),
}))

const mocked = vi.mocked(spotify)
const device = (id: string, name: string, active = false): SpotifyDevice => ({
  id,
  name,
  type: 'Computer',
  is_active: active,
  is_restricted: false,
  volume_percent: null,
})

beforeEach(() => {
  vi.clearAllMocks()
  localStorage.clear()
  mocked.isLoggedIn.mockReturnValue(true)
})

afterEach(cleanup)

describe('Spela på', () => {
  it('väljer enheten som spelar när ingen är vald, och sparar den', async () => {
    mocked.getDevices.mockResolvedValue([device('mac', 'MacBook'), device('ipad', 'iPad', true)])
    render(<SpotifySetup />)
    await waitFor(() => expect(screen.getByLabelText('Spela på')).toHaveValue('ipad'))
    expect(localStorage.getItem('spotify.device')).toBe('ipad')
    expect(screen.queryByRole('status')).not.toBeInTheDocument()
  })

  it('saknas den sparade enheten behålls den, och instruktionen visas', async () => {
    localStorage.setItem('spotify.device', 'ipad')
    mocked.getDevices.mockResolvedValue([device('mac', 'MacBook', true)])
    render(<SpotifySetup />)
    expect(await screen.findByRole('status')).toHaveTextContent(
      'Den valda enheten syns inte i Spotify. Öppna Spotify på enheten, spela och pausa en låt, stäng av automatisk låsning',
    )
    expect(screen.getByLabelText('Spela på')).toHaveValue('ipad')
    expect(localStorage.getItem('spotify.device')).toBe('ipad')
  })

  it('hittas ingen enhet visas instruktionen, och Uppdatera enheter hämtar listan igen', async () => {
    mocked.getDevices.mockResolvedValueOnce([]).mockResolvedValueOnce([device('ipad', 'iPad')])
    render(<SpotifySetup />)
    expect(await screen.findByRole('status')).toHaveTextContent('Inga enheter hittades.')
    fireEvent.click(screen.getByRole('button', { name: 'Uppdatera enheter' }))
    await waitFor(() => expect(screen.getByLabelText('Spela på')).toHaveValue('ipad'))
    expect(mocked.getDevices).toHaveBeenCalledTimes(2)
    expect(screen.queryByRole('status')).not.toBeInTheDocument()
  })

  it('den kompakta raden i quizkolumnen har Spela på och Uppdatera enheter, men ingen rubrik', async () => {
    mocked.getDevices.mockResolvedValue([device('mac', 'MacBook', true)])
    render(<SpotifySetup compact returnHash="#/admin" />)
    await waitFor(() => expect(screen.getByLabelText('Spela på')).toHaveValue('mac'))
    expect(screen.getByRole('button', { name: 'Uppdatera enheter' })).toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: 'Spotify' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Logga ut' })).not.toBeInTheDocument()
  })

  it('den kompakta raden i reservläget säger bara att admin startar låtarna själv', () => {
    localStorage.setItem('spotify.mode', 'manual')
    render(<SpotifySetup compact />)
    expect(screen.getByText(/Reservläge: du startar låtarna själv/)).toBeInTheDocument()
    expect(mocked.getDevices).not.toHaveBeenCalled()
  })
})
