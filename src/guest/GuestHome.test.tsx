import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import * as data from '../data'
import type { EventConfig, Guest, GuestRatings, LiveState } from '../types'
import type { Phase } from '../live'
import { GuestAssets, useAsset } from './assets'
import { GuestHome } from './GuestHome'
import { GuestLive } from './GuestLive'

vi.mock('../data', () => ({
  subscribeLive: vi.fn(),
  subscribeConfig: vi.fn(),
  subscribeOwnGuest: vi.fn(),
  subscribeOwnRatings: vi.fn(),
  getAssets: vi.fn(),
}))

const mocked = vi.mocked(data)
const anna: Guest = { name: 'Anna', class: 'vanlig', joinCode: 'glogg', joinedAt: 1 }

const config: EventConfig = {
  name: 'Test',
  joinOpen: true,
  gloggs: {
    g1: { class: 'vanlig', name: 'A', description: '' },
    g2: { class: 'vanlig', name: 'B', description: '' },
    g3: { class: 'vanlig', name: 'C', description: '' },
    g4: { class: 'alkfri', name: 'D', description: '' },
  },
}

/** live/ för en av de gamla faserna, som vyerna fortfarande visar (se src/live.ts). */
function liveFor(phase: Phase): LiveState {
  if (phase === 'registration') return { stage: 'lobby' }
  if (phase === 'tasting') return { stage: 'evening' }
  if (phase === 'quiz') return { stage: 'evening', quiz: { state: 'idle' } }
  if (phase === 'done') return { stage: 'done' }
  return { stage: 'wrapup', wrapup: { step: phase } }
}

function home(phase: Phase, extra: Partial<LiveState> = {}, ratings: GuestRatings = {}, onOpen = vi.fn()) {
  render(<GuestHome guest={anna} live={{ ...liveFor(phase), ...extra }} config={config} ratings={ratings} onOpen={onOpen} />)
  return onOpen
}

afterEach(cleanup)

describe('Hem', () => {
  it('hälsar gästen och visar Just nu efter kvällens läge', () => {
    home('tasting')
    expect(screen.getByRole('heading', { name: 'Hej Anna!' })).toBeInTheDocument()
    expect(screen.getByText('Glöggprovning pågår')).toBeInTheDocument()
  })

  it('Just nu visar quizet när det är igång', () => {
    home('quiz')
    expect(screen.getByText('Musikquiz pågår')).toBeInTheDocument()
  })

  it('före provningen är Ranka glögg, Kvällens glögger och Gissa glöggen låsta', () => {
    const onOpen = home('registration')
    expect(screen.getByText('Ranka glögg öppnar när provningen börjar')).toBeInTheDocument()
    expect(screen.getByText('Kvällens glögger visas när provningen börjar')).toBeInTheDocument()
    expect(screen.getByText('Gissa glöggen öppnar i slutet av kvällen')).toBeInTheDocument()
    expect(screen.getByText('Startar snart')).toBeInTheDocument()
    expect(screen.queryAllByRole('button')).toEqual([])
    expect(onOpen).not.toHaveBeenCalled()
  })

  it('under provningen går Ranka glögg att öppna och visar hur många som är provade', () => {
    // Nummer 3 har ett tomt objekt och räknas inte som provad.
    const onOpen = home('tasting', {}, { '1': { c1: 4 }, '2': { c1: 3, c2: 5 }, '3': {} })
    const ranka = screen.getByRole('button', { name: /Ranka glögg/ })
    expect(within(ranka).getByText('2 av 3 provade')).toBeInTheDocument()
    fireEvent.click(ranka)
    fireEvent.click(screen.getByRole('button', { name: /Kvällens glögger/ }))
    expect(onOpen.mock.calls).toEqual([['ranka'], ['glogger']])
  })

  it('efter provningen är Ranka glögg klar och går inte att öppna', () => {
    home('quiz', {}, { '1': { c1: 4 } })
    expect(screen.queryByRole('button', { name: /Ranka glögg/ })).not.toBeInTheDocument()
    expect(screen.getByText('1 av 3 provade')).toBeInTheDocument()
    expect(screen.getByText('Pågår')).toBeInTheDocument()
  })

  it('Gissa glöggen öppnar i gissningsfasen och låses sedan', () => {
    const onOpen = home('guess')
    fireEvent.click(screen.getByRole('button', { name: /Gissa glöggen/ }))
    expect(onOpen).toHaveBeenCalledWith('gissa')
    cleanup()
    home('reveal')
    expect(screen.getByText('Gissningarna är låsta')).toBeInTheDocument()
  })

  it('korten är inte klickbara när undersidan saknas', () => {
    render(<GuestHome guest={anna} live={{ stage: 'evening' }} config={config} ratings={{}} />)
    expect(screen.queryAllByRole('button')).toEqual([])
    expect(screen.getByText('0 av 3 provade')).toBeInTheDocument()
  })

  it('visar fas registrering tills live/ har svarat', () => {
    render(<GuestHome guest={anna} live={null} config={null} ratings={{}} />)
    expect(screen.getByText('Kvällen börjar snart')).toBeInTheDocument()
  })
})

describe('GuestLive', () => {
  type Callback<T> = (value: T) => void
  let pushLive: Callback<LiveState | null>
  let pushGuest: Callback<Guest | null>
  let failConfig: (error: Error) => void

  beforeEach(() => {
    vi.resetAllMocks()
    mocked.subscribeLive.mockImplementation((_e, callback) => {
      pushLive = callback
      return () => {}
    })
    mocked.subscribeConfig.mockImplementation((_e, callback, onError) => {
      callback(config)
      failConfig = onError!
      return () => {}
    })
    mocked.subscribeOwnGuest.mockImplementation((_e, _uid, callback) => {
      pushGuest = callback
      return () => {}
    })
    mocked.subscribeOwnRatings.mockImplementation((_e, _uid, callback) => {
      callback({ '1': { c1: 5 } })
      return () => {}
    })
    mocked.getAssets.mockResolvedValue({ img1: 'data:image/webp;base64,AAA' })
  })

  it('följer live/ när admin startar kvällen', () => {
    render(<GuestLive eventId="demo" uid="u1" guest={anna} />)
    act(() => pushLive({ stage: 'lobby' }))
    expect(screen.getByText('Ranka glögg öppnar när provningen börjar')).toBeInTheDocument()
    act(() => pushLive({ stage: 'evening' }))
    expect(screen.getByText('Glöggprovning pågår')).toBeInTheDocument()
    expect(screen.getByText('1 av 3 provade')).toBeInTheDocument()
  })

  it('räknar glögger i gästens nya klass när admin byter klass', () => {
    render(<GuestLive eventId="demo" uid="u1" guest={anna} />)
    act(() => pushLive({ stage: 'evening' }))
    act(() => pushGuest({ ...anna, class: 'alkfri' }))
    expect(screen.getByText('1 av 1 provade')).toBeInTheDocument()
  })

  it('säger till när admin har tagit bort gästen', () => {
    render(<GuestLive eventId="demo" uid="u1" guest={anna} />)
    act(() => pushGuest(null))
    expect(screen.getByRole('heading', { name: 'Du är inte med längre' })).toBeInTheDocument()
  })

  it('säger till när prenumerationen nekas', () => {
    render(<GuestLive eventId="demo" uid="u1" guest={anna} />)
    act(() => failConfig(new Error('permission_denied')))
    expect(screen.getByRole('heading', { name: 'Tappade kontakten' })).toBeInTheDocument()
  })

  it('förladdar bilderna en gång, även när live/ ändras', async () => {
    render(<GuestLive eventId="demo" uid="u1" guest={anna} />)
    act(() => pushLive({ stage: 'evening' }))
    act(() => pushLive({ stage: 'evening' }))
    await act(async () => {})
    expect(mocked.getAssets).toHaveBeenCalledTimes(1)
    expect(mocked.getAssets).toHaveBeenCalledWith('demo')
  })
})

describe('useAsset', () => {
  function ShowAsset({ id }: { id?: string }) {
    return <span>{useAsset(id) ?? 'saknas'}</span>
  }

  it('läser bilden från de förladdade bilderna', () => {
    render(
      <GuestAssets.Provider value={{ img1: 'data:image/webp;base64,AAA' }}>
        <ShowAsset id="img1" />
        <ShowAsset id="okänd" />
        <ShowAsset />
      </GuestAssets.Provider>,
    )
    expect(screen.getByText('data:image/webp;base64,AAA')).toBeInTheDocument()
    expect(screen.getAllByText('saknas')).toHaveLength(2)
  })
})
