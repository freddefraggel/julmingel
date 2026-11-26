import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import * as data from '../data'
import type { Preparation } from '../data'
import PrepareEvening from './PrepareEvening'

vi.mock('../data', () => ({
  loadPreparation: vi.fn(),
  newConfigId: vi.fn(),
  savePreparation: vi.fn(),
  setGloggImage: vi.fn(),
  subscribeAssets: vi.fn(),
  removeAsset: vi.fn(),
  saveAsset: vi.fn(),
  touchEventIndex: vi.fn(() => Promise.resolve()),
}))

const mocked = vi.mocked(data)

const preparation: Preparation = {
  config: {
    name: 'Julmingel',
    joinOpen: true,
    gloggs: {
      g1: { class: 'vanlig', name: 'Röd', description: 'Kanel' },
      g2: { class: 'vanlig', name: 'Vit', description: '', imageId: 'i2' },
      g3: { class: 'alkfri', name: 'Äpple', description: '' },
    },
    criteria: { c1: { name: 'Julkänsla', order: 1, lowIsGood: false } },
  },
  joinCode: 'glogg',
  numbers: { vanlig: { '1': 'g1', '2': 'g2' }, alkfri: { '1': 'g3' } },
  correct: null,
  stage: 'lobby',
}

async function open(prep: Preparation = preparation) {
  mocked.loadPreparation.mockResolvedValue(prep)
  render(
    <MemoryRouter initialEntries={['/admin/forbered?e=demo']}>
      <PrepareEvening />
    </MemoryRouter>,
  )
  await screen.findByRole('heading', { name: 'Glögger' })
}

const save = () => fireEvent.click(screen.getByRole('button', { name: 'Spara' }))
const savedChanges = () => mocked.savePreparation.mock.calls[0]![1] as Record<string, unknown>

beforeEach(() => {
  vi.resetAllMocks()
  localStorage.clear()
  mocked.subscribeAssets.mockReturnValue(() => {})
  mocked.savePreparation.mockResolvedValue()
  mocked.removeAsset.mockResolvedValue()
  let n = 0
  mocked.newConfigId.mockImplementation((_e, kind) => `ny-${kind}-${++n}`)
})

afterEach(cleanup)

describe('Förbered kvällen', () => {
  it('ber admin välja kväll när ingen är vald', () => {
    render(
      <MemoryRouter initialEntries={['/admin/forbered']}>
        <PrepareEvening />
      </MemoryRouter>,
    )
    expect(screen.getByText('Välj först vilken kväll du vill förbereda.')).toBeInTheDocument()
    expect(mocked.loadPreparation).not.toHaveBeenCalled()
  })

  it('visar glöggerna i serveringsordning per klass, med antal i flikarna', async () => {
    await open()
    expect(screen.getByLabelText('Namn på glögg 1')).toHaveValue('Röd')
    expect(screen.getByLabelText('Namn på glögg 2')).toHaveValue('Vit')
    fireEvent.click(screen.getByRole('tab', { name: 'Alkoholfri · 1' }))
    expect(screen.getByLabelText('Namn på glögg 1')).toHaveValue('Äpple')
    expect(screen.queryByLabelText('Namn på glögg 2')).not.toBeInTheDocument()
  })

  it('Spara är avstängt tills något ändras', async () => {
    await open()
    expect(screen.getByRole('button', { name: 'Spara' })).toBeDisabled()
    fireEvent.change(screen.getByLabelText('Namn'), { target: { value: 'Glöggkväll' } })
    expect(screen.getByText('Osparade ändringar')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Spara' })).toBeEnabled()
  })

  it('byter ordning och sparar numren bara i secret/', async () => {
    await open()
    fireEvent.click(screen.getByRole('button', { name: 'Flytta ned glögg 1' }))
    expect(screen.getByLabelText('Namn på glögg 1')).toHaveValue('Vit')
    save()
    expect(await screen.findByText('Sparat')).toBeInTheDocument()
    expect(mocked.savePreparation).toHaveBeenCalledWith('demo', expect.any(Object))
    const changes = savedChanges()
    expect(changes['secret/numbers']).toEqual({ vanlig: { '1': 'g2', '2': 'g1' }, alkfri: { '1': 'g3' } })
    expect(changes['config/gloggs']).toEqual({
      g1: { class: 'vanlig', name: 'Röd', description: 'Kanel' },
      g2: { class: 'vanlig', name: 'Vit', description: '', imageId: 'i2' },
      g3: { class: 'alkfri', name: 'Äpple', description: '' },
    })
    expect(screen.getByRole('button', { name: 'Spara' })).toBeDisabled()
  })

  it('lägger till en glögg med slumpat id i vald klass', async () => {
    await open()
    fireEvent.click(screen.getByRole('tab', { name: 'Alkoholfri · 1' }))
    fireEvent.click(within(screen.getByRole('heading', { name: 'Glögger' }).closest('.card')!).getByRole('button', { name: '+ Lägg till' }))
    fireEvent.change(screen.getByLabelText('Namn på glögg 2'), { target: { value: 'Svartvinbär' } })
    expect(screen.getByRole('tab', { name: 'Alkoholfri · 2' })).toBeInTheDocument()
    save()
    await screen.findByText('Sparat')
    expect(savedChanges()['secret/numbers']).toEqual({ vanlig: { '1': 'g1', '2': 'g2' }, alkfri: { '1': 'g3', '2': 'ny-gloggs-1' } })
  })

  it('tar bort en glögg och dess bild när admin sparar', async () => {
    await open()
    fireEvent.click(screen.getByRole('button', { name: 'Ta bort glögg 2' }))
    save()
    await screen.findByText('Sparat')
    expect(savedChanges()['config/gloggs']).not.toHaveProperty('g2')
    expect(mocked.removeAsset).toHaveBeenCalledWith('demo', 'i2')
  })

  it('lägger till, flaggar och sorterar kriterier', async () => {
    await open()
    fireEvent.click(within(screen.getByRole('heading', { name: 'Ranka på (1–5)' }).closest('.card')!).getByRole('button', { name: '+ Lägg till' }))
    fireEvent.change(screen.getByLabelText('Namn på kriterium 2'), { target: { value: 'Sliskighet' } })
    fireEvent.click(screen.getAllByLabelText('lågt = bra')[1]!)
    fireEvent.click(screen.getByRole('button', { name: 'Flytta upp Sliskighet' }))
    save()
    await screen.findByText('Sparat')
    expect(savedChanges()['config/criteria']).toEqual({
      'ny-criteria-1': { name: 'Sliskighet', order: 1, lowIsGood: true },
      c1: { name: 'Julkänsla', order: 2, lowIsGood: false },
    })
  })

  it('sparar inte när något saknas och säger vad', async () => {
    await open()
    fireEvent.change(screen.getByLabelText('Kod i QR-länken'), { target: { value: '' } })
    fireEvent.change(screen.getByLabelText('Namn på glögg 2'), { target: { value: ' ' } })
    save()
    const alert = await screen.findByRole('alert')
    expect(alert).toHaveTextContent('Kvällen behöver en kod till QR-länken.')
    expect(alert).toHaveTextContent('Vanlig glögg 2 saknar namn.')
    expect(mocked.savePreparation).not.toHaveBeenCalled()
  })

  it('sparar kvällens namn och kod', async () => {
    await open()
    fireEvent.change(screen.getByLabelText('Namn'), { target: { value: ' Glöggkväll ' } })
    fireEvent.change(screen.getByLabelText('Kod i QR-länken'), { target: { value: 'tomte' } })
    save()
    await screen.findByText('Sparat')
    expect(savedChanges()).toMatchObject({ 'config/name': 'Glöggkväll', 'secret/joinCode': 'tomte' })
    expect(mocked.touchEventIndex).toHaveBeenCalledWith('demo', 'Glöggkväll')
  })

  it('säger till när sparandet misslyckas', async () => {
    mocked.savePreparation.mockRejectedValue(new Error('offline'))
    await open()
    fireEvent.change(screen.getByLabelText('Namn'), { target: { value: 'Glöggkväll' } })
    save()
    expect(await screen.findByRole('alert')).toHaveTextContent('Kunde inte spara')
  })

  it('varnar för att byta ordning när provningen har börjat', async () => {
    await open({ ...preparation, stage: 'evening' })
    expect(screen.getByRole('note')).toHaveTextContent('Provningen har börjat')
  })

  it('säger till när kvällen inte kan hämtas', async () => {
    mocked.loadPreparation.mockRejectedValue(new Error('permission_denied'))
    render(
      <MemoryRouter initialEntries={['/admin/forbered?e=demo']}>
        <PrepareEvening />
      </MemoryRouter>,
    )
    expect(await screen.findByRole('alert')).toHaveTextContent('Kunde inte hämta kvällen ”demo”')
  })
})

describe('Förvalda kriterier', () => {
  it('en kväll utan kriterier får designens kriterier, som sparas med Spara', async () => {
    await open({ ...preparation, config: { ...preparation.config!, criteria: undefined } })
    const names = ['Julkänsla', 'Mysfaktor', 'Doft', 'Sliskighet', 'Kvalmighet', 'Påtår?']
    names.forEach((name, i) => expect(screen.getByLabelText(`Namn på kriterium ${i + 1}`)).toHaveValue(name))
    expect(screen.getAllByLabelText('lågt = bra').map((box) => (box as HTMLInputElement).checked)).toEqual([
      false, false, false, true, true, false,
    ])
    expect(screen.getByText('Osparade ändringar')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Ta bort Påtår?' }))
    save()
    await screen.findByText('Sparat')
    const criteria = savedChanges()['config/criteria'] as Record<string, { name: string; order: number }>
    expect(Object.values(criteria).map((c) => [c.name, c.order])).toEqual([
      ['Julkänsla', 1],
      ['Mysfaktor', 2],
      ['Doft', 3],
      ['Sliskighet', 4],
      ['Kvalmighet', 5],
    ])
  })
})

describe('Musikquiz', () => {
  const TRACK = 'spotify:track:2FRnf9qhLbvw8fu4IBXx78'
  const withQuiz: Preparation = {
    ...preparation,
    config: {
      ...preparation.config!,
      songs: { s1: { order: 1, spotifyUri: TRACK, title: 'Last Christmas', startMs: 30_000, secondsPerQuestion: 30 } },
      questions: {
        q1: { songId: 's1', order: 1, text: 'Årtal?', answerType: 'text', options: { A: '1984', B: '1985', C: '1986', D: '1987' } },
      },
    },
    correct: { q1: 'A' },
  }

  const quiz = () => screen.getByRole('heading', { name: /^Musikquiz/ }).closest('.card') as HTMLElement

  it('visar översikten och den valda låtens fält', async () => {
    await open(withQuiz)
    expect(screen.getByRole('heading', { name: 'Musikquiz · 1 låt · 1 fråga' })).toBeInTheDocument()
    expect(screen.getByLabelText('Spotify-länk')).toHaveValue(TRACK)
    expect(screen.getByLabelText('Starta vid')).toHaveValue('0:30')
    expect(screen.getByLabelText('Svar A är rätt')).toBeChecked()
    expect(screen.getByLabelText('Svar B')).toHaveValue('1985')
  })

  it('lägger till en låt med en fråga och sparar facit bara i secret/correct', async () => {
    await open()
    fireEvent.click(within(quiz()).getByRole('button', { name: '+ Ny låt' }))
    fireEvent.change(screen.getByLabelText('Spotify-länk'), {
      target: { value: 'https://open.spotify.com/track/2FRnf9qhLbvw8fu4IBXx78?si=x' },
    })
    fireEvent.change(screen.getByLabelText('Starta vid'), { target: { value: '0:45' } })
    fireEvent.change(screen.getByLabelText('Fråga'), { target: { value: 'Vilket år?' } })
    for (const [choice, text] of [['A', '1983'], ['B', '1984'], ['C', '1985'], ['D', '1986']]) {
      fireEvent.change(screen.getByLabelText(`Svar ${choice}`), { target: { value: text } })
    }
    fireEvent.click(screen.getByLabelText('Svar B är rätt'))
    expect(screen.getByRole('heading', { name: 'Musikquiz · 1 låt · 1 fråga' })).toBeInTheDocument()
    save()
    await screen.findByText('Sparat')
    const changes = savedChanges()
    expect(changes['config/songs']).toEqual({
      'ny-songs-1': { order: 1, spotifyUri: TRACK, startMs: 45_000, secondsPerQuestion: 30 },
    })
    expect(changes['config/questions']).toEqual({
      'ny-questions-2': {
        songId: 'ny-songs-1',
        order: 1,
        text: 'Vilket år?',
        answerType: 'text',
        options: { A: '1983', B: '1984', C: '1985', D: '1986' },
      },
    })
    expect(changes['secret/correct']).toEqual({ 'ny-questions-2': 'B' })
  })

  it('kräver rätt svar och giltig länk innan den sparar', async () => {
    await open()
    fireEvent.click(within(quiz()).getByRole('button', { name: '+ Ny låt' }))
    fireEvent.change(screen.getByLabelText('Spotify-länk'), { target: { value: 'last christmas' } })
    expect(screen.getByLabelText('Spotify-länk')).toHaveAttribute('aria-invalid', 'true')
    save()
    const alert = await screen.findByRole('alert')
    expect(alert).toHaveTextContent('Låt 1: Spotify-länken ska se ut som')
    expect(alert).toHaveTextContent('Fråga 1: tryck på det rätta svaret.')
    expect(mocked.savePreparation).not.toHaveBeenCalled()
  })

  it('lägger till fler frågor till samma låt, numrerade över hela quizet', async () => {
    await open(withQuiz)
    fireEvent.click(screen.getByRole('button', { name: '+ Fråga till låten' }))
    expect(screen.getByRole('tab', { name: 'Fråga 2', selected: true })).toBeInTheDocument()
    expect(screen.getByLabelText('Fråga')).toHaveValue('')
    fireEvent.click(screen.getByRole('tab', { name: /Fråga 1/ }))
    expect(screen.getByLabelText('Fråga')).toHaveValue('Årtal?')
    expect(screen.getByRole('heading', { name: 'Musikquiz · 1 låt · 2 frågor' })).toBeInTheDocument()
  })

  it('byter svarstyp till Bild och visar bildfält per svar', async () => {
    await open(withQuiz)
    fireEvent.click(screen.getByRole('button', { name: 'Bild' }))
    expect(screen.getByRole('button', { name: 'Bild' })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByLabelText('Bildlänk för svar A')).toBeInTheDocument()
    expect(screen.queryByLabelText('Svar A')).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Text' }))
    expect(screen.getByLabelText('Svar A')).toHaveValue('1984')
  })

  it('tar bort en låt med dess frågor', async () => {
    await open(withQuiz)
    fireEvent.click(screen.getByRole('button', { name: 'Ta bort låt 1' }))
    expect(screen.getByRole('heading', { name: 'Musikquiz · 0 låtar · 0 frågor' })).toBeInTheDocument()
    save()
    await screen.findByText('Sparat')
    expect(savedChanges()).toMatchObject({ 'config/songs': {}, 'config/questions': {}, 'secret/correct': {} })
  })
})

describe('Spotify', () => {
  it('ber om inloggning och kan byta till reservläget', async () => {
    await open()
    expect(screen.getByRole('button', { name: 'Logga in med Spotify' })).toBeInTheDocument()
    fireEvent.click(screen.getByRole('tab', { name: 'Reservläge' }))
    expect(screen.getByText(/Reservläge: du startar låtarna själv/)).toBeInTheDocument()
    expect(localStorage.getItem('spotify.mode')).toBe('manual')
  })
})
