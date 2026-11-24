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
  phase: 'registration',
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
  })

  it('säger till när sparandet misslyckas', async () => {
    mocked.savePreparation.mockRejectedValue(new Error('offline'))
    await open()
    fireEvent.change(screen.getByLabelText('Namn'), { target: { value: 'Glöggkväll' } })
    save()
    expect(await screen.findByRole('alert')).toHaveTextContent('Kunde inte spara')
  })

  it('varnar för att byta ordning när provningen har börjat', async () => {
    await open({ ...preparation, phase: 'tasting' })
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
