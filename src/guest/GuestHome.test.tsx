import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import * as data from '../data'
import type { EventConfig, Guest, GuestRatings, LiveState } from '../types'
import { GuestAssets, useAsset } from './assets'
import { GuestHome } from './GuestHome'
import { GuestLive } from './GuestLive'

vi.mock('../data', () => ({
  subscribeLive: vi.fn(),
  subscribeConfig: vi.fn(),
  subscribeOwnGuest: vi.fn(),
  subscribeOwnRatings: vi.fn(),
  subscribeNotes: vi.fn(() => () => {}),
  saveNote: vi.fn(() => Promise.resolve()),
  getAssets: vi.fn(),
  subscribeServerTimeOffset: vi.fn(() => () => {}),
  subscribeOwnAnswer: vi.fn(() => () => {}),
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
const TRACK = 'spotify:track:2FRnf9qhLbvw8fu4IBXx78'
const withQuiz: EventConfig = {
  ...config,
  songs: { s1: { order: 1, spotifyUri: TRACK, startMs: 0, secondsPerQuestion: 20 } },
  questions: Object.fromEntries(
    [1, 2, 3, 4].map((n) => [`q${n}`, { songId: 's1', order: n, text: `Fråga ${n}`, answerType: 'text' as const, options: { A: 'a', B: 'b', C: 'c', D: 'd' } }]),
  ),
}

function home(live: LiveState | null, ratings: GuestRatings = {}, onOpen = vi.fn(), cfg: EventConfig = config) {
  render(<GuestHome guest={anna} live={live} config={cfg} ratings={ratings} onOpen={onOpen} />)
  return onOpen
}

afterEach(cleanup)

describe('Hem innan start', () => {
  it('välkomnar gästen och berättar om kvällen, utan kort för det som inte har öppnat', () => {
    home({ stage: 'lobby' })
    expect(screen.getByRole('heading', { name: 'Välkommen, Anna' })).toBeInTheDocument()
    const tonight = screen.getByRole('region', { name: 'Ikväll' })
    expect(within(tonight).getAllByRole('listitem').map((li) => li.querySelector('strong')!.textContent)).toEqual([
      'Glöggprovning',
      'Musikquiz',
      'Avslöjande',
    ])
    expect(screen.getByText('Kvällen börjar snart')).toBeInTheDocument()
    expect(screen.queryAllByRole('button')).toEqual([])
  })

  it('visar kvällens namn ovanför välkomsten', () => {
    home({ stage: 'lobby' }, {}, vi.fn(), { ...config, name: 'Gröna Villans Glöggmingel 2026' })
    expect(screen.getByText('Gröna Villans Glöggmingel 2026')).toBeInTheDocument()
  })

  it('visar Innan start tills live/ har svarat', () => {
    home(null)
    expect(screen.getByRole('heading', { name: 'Välkommen, Anna' })).toBeInTheDocument()
  })
})

describe('Hem under kvällen', () => {
  const open = (serving: number | null) => ({ vanlig: { open: true, serving, next: null } })

  it('ett enda glöggkort: vad som serveras, hur många gästen har rankat, Ranka nr N och Se kvällens glögger', () => {
    const onOpen = home({ stage: 'evening', tasting: open(3) }, { '1': { c1: 4 }, '2': { c1: 3, c2: 5 }, '3': {} })
    const card = screen.getByRole('region', { name: 'Glöggprovning' })
    expect(card).toHaveTextContent('Nu serveras nr 3 · du har rankat 2 av 3')
    fireEvent.click(within(card).getByRole('button', { name: 'Ranka nr 3' }))
    fireEvent.click(within(card).getByRole('button', { name: 'Se kvällens glögger' }))
    expect(onOpen.mock.calls).toEqual([['ranka'], ['glogger']])
  })

  it('inget Just nu-kort, inget quizkort och ingen låst Gissa glöggen', () => {
    home({ stage: 'evening', tasting: open(1) })
    expect(screen.queryByText(/Just nu/)).not.toBeInTheDocument()
    expect(screen.queryByRole('region', { name: 'Musikquiz' })).not.toBeInTheDocument()
    expect(screen.queryByText(/Gissa glöggen/)).not.toBeInTheDocument()
  })

  it('en rad om quizet: hur många frågor som är klara', () => {
    home({ stage: 'evening', quiz: { state: 'closed', qId: 'q3' } }, {}, vi.fn(), withQuiz)
    expect(screen.getByText(/3 av 4 frågor klara · nästa kan komma när som helst/)).toBeInTheDocument()
    cleanup()
    home({ stage: 'evening', quiz: { state: 'open', qId: 'q2', openedAt: 1, durationMs: 2 } }, {}, vi.fn(), withQuiz)
    expect(screen.getByText(/1 av 4 frågor klara/)).toBeInTheDocument()
    cleanup()
    home({ stage: 'evening', quiz: { state: 'closed', qId: 'q4' } }, {}, vi.fn(), withQuiz)
    expect(screen.getByText(/alla frågor klara/)).toBeInTheDocument()
  })

  it('provningen har inte börjat, eller är stängd', () => {
    home({ stage: 'evening' })
    expect(screen.getByText('Glöggprovningen börjar snart')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Ranka/ })).not.toBeInTheDocument()
    cleanup()
    home({ stage: 'evening', tasting: { vanlig: { open: false, serving: 3, next: null } } })
    expect(screen.getByText('Provningen är stängd – tack för dina betyg')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Se kvällens glögger' })).toBeInTheDocument()
  })

  it('Gissa glöggen visas först när steget är guess', () => {
    const onOpen = home({ stage: 'wrapup', wrapup: { step: 'guess' } })
    fireEvent.click(within(screen.getByRole('region', { name: 'Gissa glöggen' })).getByRole('button', { name: 'Gissa nu' }))
    expect(onOpen).toHaveBeenCalledWith('gissa')
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
    expect(screen.getByRole('heading', { name: 'Välkommen, Anna' })).toBeInTheDocument()
    act(() => pushLive({ stage: 'evening', tasting: { vanlig: { open: true, serving: null, next: null } } }))
    expect(screen.getByText(/du har rankat 1 av 3/)).toBeInTheDocument()
  })

  it('räknar glögger i gästens nya klass när admin byter klass', () => {
    render(<GuestLive eventId="demo" uid="u1" guest={anna} />)
    act(() => pushLive({ stage: 'evening', tasting: { alkfri: { open: true, serving: null, next: null } } }))
    act(() => pushGuest({ ...anna, class: 'alkfri' }))
    expect(screen.getByText(/du har rankat 1 av 1/)).toBeInTheDocument()
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

  it('Till provningen lämnar Lyssna noga, och nästa läge visas igen', () => {
    render(<GuestLive eventId="demo" uid="u1" guest={anna} />)
    act(() => pushLive({ stage: 'evening', quiz: { state: 'playing', songId: 's1', qId: 'q1' } }))
    expect(screen.getByRole('heading', { name: 'Lyssna noga …' })).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Till provningen' }))
    expect(screen.getByRole('heading', { name: 'Hej Anna!' })).toBeInTheDocument()
    act(() => pushLive({ stage: 'evening', quiz: { state: 'playing', songId: 's2', qId: 'q2' } }))
    expect(screen.getByRole('heading', { name: 'Lyssna noga …' })).toBeInTheDocument()
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
