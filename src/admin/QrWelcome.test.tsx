import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import * as data from '../data'
import type { EventConfig } from '../types'
import QrWelcome from './QrWelcome'

vi.mock('../data', () => ({
  openAdminEvent: vi.fn(),
  subscribeConfig: vi.fn(),
}))

// QR-koden ritas som en SVG som innehåller länken, så att testet kan läsa den.
vi.mock('qrcode', () => ({
  default: { toString: vi.fn(async (url: string) => `<svg><title>${url}</title></svg>`) },
}))

const mocked = vi.mocked(data)
let pushConfig: (config: EventConfig | null) => void

function renderAt(url: string, print = false) {
  render(
    <MemoryRouter initialEntries={[url]}>
      <QrWelcome print={print} />
    </MemoryRouter>,
  )
}

/** Länken som QR-koden pekar på, ur bildens data-URL. */
async function qrUrl() {
  const code = await screen.findByRole('img', { name: 'QR-kod till kvällens sida' })
  const img = await within(code).findByRole('presentation')
  return decodeURIComponent(img.getAttribute('src')!)
}

beforeEach(() => {
  vi.clearAllMocks()
  localStorage.clear()
  mocked.openAdminEvent.mockResolvedValue({ ok: true, name: 'Glöggmingel', joinCode: 'tomte' })
  mocked.subscribeConfig.mockImplementation((_e, callback) => {
    pushConfig = callback
    callback({ name: 'Glöggmingel', joinOpen: true })
    return () => {}
  })
})

afterEach(cleanup)

describe('Välkomstskärmen', () => {
  it('välkomnar med tre steg och en stor QR-kod med gästlänken och joinCode', async () => {
    renderAt('/admin/qr?e=demo')
    expect(screen.getByRole('heading', { name: 'Välkommen in i värmen!' })).toBeInTheDocument()
    expect(screen.getAllByRole('listitem').map((li) => li.textContent)).toEqual([
      '1Scanna koden med kameran',
      '2Skriv ditt namn',
      '3Välj vanlig eller alkoholfri provning',
    ])
    expect(await qrUrl()).toMatch(/#\/\?e=demo&k=tomte</)
    expect(screen.getByText('Scanna för att vara med')).toBeInTheDocument()
  })

  it('visar kvällens namn, och Glöggmingel när det saknas', () => {
    renderAt('/admin/qr?e=demo')
    expect(screen.getByText('Glöggmingel')).toBeInTheDocument()
    act(() => pushConfig({ name: 'Gröna Villans Glöggmingel 2026', joinOpen: true }))
    expect(screen.getByText('Gröna Villans Glöggmingel 2026')).toBeInTheDocument()
  })

  it('har en länk till utskriftsvyn och tillbaka till kontrollpanelen', () => {
    renderAt('/admin/qr?e=demo')
    expect(screen.getByRole('link', { name: 'Skriv ut som A4' })).toHaveAttribute('href', '/admin/qr/print')
    expect(screen.getByRole('link', { name: 'Till kontrollpanelen' })).toHaveAttribute('href', '/admin')
  })

  it('varnar admin när registreringen är stängd', () => {
    renderAt('/admin/qr?e=demo')
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
    act(() => pushConfig({ name: 'Glöggmingel', joinOpen: false }))
    expect(screen.getByRole('alert')).toHaveTextContent('Registreringen är stängd')
  })

  it('kommer ihåg kvällen från kontrollpanelen', async () => {
    localStorage.setItem('julmingel.adminEvent', 'demo')
    renderAt('/admin/qr')
    expect(await qrUrl()).toMatch(/e=demo&k=tomte/)
  })

  it('säger till när ingen kväll är vald', () => {
    renderAt('/admin/qr')
    expect(screen.getByRole('alert')).toHaveTextContent('Välj först vilken kväll det gäller.')
  })
})

describe('A4-affischen', () => {
  it('har samma innehåll och QR-kod, och en Skriv ut-knapp', async () => {
    const print = vi.spyOn(window, 'print').mockImplementation(() => {})
    renderAt('/admin/qr/print?e=demo', true)
    expect(screen.getByRole('heading', { name: 'Välkommen in i värmen!' })).toBeInTheDocument()
    expect(screen.getByText('God jul!')).toBeInTheDocument()
    expect(await qrUrl()).toMatch(/e=demo&k=tomte/)
    const button = screen.getByRole('button', { name: 'Skriv ut' })
    // Knappen syns inte på utskriften.
    expect(button.closest('.no-print')).not.toBeNull()
    fireEvent.click(button)
    expect(print).toHaveBeenCalled()
    print.mockRestore()
  })
})
