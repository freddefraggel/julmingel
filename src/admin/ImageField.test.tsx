import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { removeAsset, saveAsset } from '../data'
import { CORS_WARNING, ImageField } from './ImageField'
import { compressImage, imageFromLink } from './images'

vi.mock('../data', () => ({
  saveAsset: vi.fn(),
  removeAsset: vi.fn(),
}))

vi.mock('./images', () => ({
  compressImage: vi.fn(),
  imageFromLink: vi.fn(),
}))

const webp = 'data:image/webp;base64,AAAA'

beforeEach(() => {
  vi.mocked(saveAsset).mockResolvedValue('nyBild')
  vi.mocked(removeAsset).mockResolvedValue()
  vi.mocked(compressImage).mockResolvedValue(webp)
})

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
})

function chooseFile(label: string) {
  const file = new File(['x'], 'glogg.jpg', { type: 'image/jpeg' })
  fireEvent.change(screen.getByTestId(`fil för ${label}`), { target: { files: [file] } })
  return file
}

describe('ImageField', () => {
  it('komprimerar en uppladdad fil, sparar den och tar bort den gamla bilden', async () => {
    const onChange = vi.fn()
    render(<ImageField eventId="demo" imageId="gammal" label="glögg 1" onChange={onChange} />)
    expect(screen.getByRole('button', { name: 'Ladda upp bild för glögg 1' })).toBeInTheDocument()

    const file = chooseFile('glögg 1')

    await waitFor(() => expect(onChange).toHaveBeenCalledWith('nyBild'))
    expect(compressImage).toHaveBeenCalledWith(file)
    expect(saveAsset).toHaveBeenCalledWith('demo', webp)
    expect(removeAsset).toHaveBeenCalledWith('demo', 'gammal')
  })

  it('sparar en länk som kunde komprimeras', async () => {
    vi.mocked(imageFromLink).mockResolvedValue({ kind: 'compressed', dataUrl: webp })
    const onChange = vi.fn()
    render(<ImageField eventId="demo" label="svar A" variant="answer" onChange={onChange} />)
    expect(screen.getByText('Ingen bild än')).toBeInTheDocument()

    const input = screen.getByRole('textbox', { name: 'Bildlänk för svar A' })
    fireEvent.change(input, { target: { value: 'https://example.com/a.png' } })
    fireEvent.submit(input)

    await waitFor(() => expect(onChange).toHaveBeenCalledWith('nyBild'))
    expect(saveAsset).toHaveBeenCalledWith('demo', webp)
    expect(removeAsset).not.toHaveBeenCalled()
    expect(screen.queryByRole('status')).not.toBeInTheDocument()
  })

  it('sparar länken som den är och varnar när sajten blockerar hämtningen', async () => {
    vi.mocked(imageFromLink).mockResolvedValue({ kind: 'link', url: 'https://example.com/a.jpg' })
    const onChange = vi.fn()
    render(<ImageField eventId="demo" label="svar B" variant="answer" onChange={onChange} />)

    const input = screen.getByRole('textbox', { name: 'Bildlänk för svar B' })
    fireEvent.change(input, { target: { value: 'https://example.com/a.jpg' } })
    fireEvent.submit(input)

    expect(await screen.findByRole('status')).toHaveTextContent(CORS_WARNING)
    expect(saveAsset).toHaveBeenCalledWith('demo', 'https://example.com/a.jpg')
    expect(onChange).toHaveBeenCalledWith('nyBild')
  })

  it('visar felet och sparar inget när bilden inte går att läsa', async () => {
    vi.mocked(compressImage).mockRejectedValue(new Error('Filen är ingen bild.'))
    const onChange = vi.fn()
    render(<ImageField eventId="demo" imageId="gammal" label="glögg 2" onChange={onChange} />)

    chooseFile('glögg 2')

    expect(await screen.findByRole('alert')).toHaveTextContent('Filen är ingen bild.')
    expect(saveAsset).not.toHaveBeenCalled()
    expect(removeAsset).not.toHaveBeenCalled()
    expect(onChange).not.toHaveBeenCalled()
  })

  it('visar sparad bild och markerar länkade bilder', () => {
    render(<ImageField eventId="demo" imageId="i1" src="https://example.com/a.jpg" label="svar C" variant="answer" onChange={vi.fn()} />)
    expect(screen.getByRole('img', { name: 'Bild för svar C' })).toHaveAttribute('src', 'https://example.com/a.jpg')
    expect(screen.getByText('Länkad bild, inte sparad i databasen.')).toBeInTheDocument()
  })
})
