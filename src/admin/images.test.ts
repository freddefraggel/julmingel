import { describe, expect, it, vi } from 'vitest'
import { compressImage, dataUrlBytes, fitWithin, imageFromLink, TARGET_BYTES, type Decoded, type Encoder } from './images'

const png = new Blob(['x'], { type: 'image/png' })

/** Låtsasbild i given storlek. */
const decodeAs = (width: number, height: number) => async (): Promise<Decoded> => ({ source: {} as CanvasImageSource, width, height })

/** Data-URL med ungefär `bytes` byte, av given typ. */
function dataUrl(type: string, bytes: number) {
  return `data:${type};base64,${'A'.repeat(Math.ceil((bytes * 4) / 3))}`
}

/** Kodare där storleken är proportionell mot pixlar × kvalitet. */
function fakeEncoder(bytesPerPixel: number, supportsWebp = true) {
  return vi.fn<Encoder>((_image, { width, height }, type, quality) =>
    dataUrl(supportsWebp || type !== 'image/webp' ? type : 'image/png', width * height * quality * bytesPerPixel),
  )
}

describe('fitWithin', () => {
  it('skalar ned så att längsta sidan blir 800 px', () => {
    expect(fitWithin(4000, 3000)).toEqual({ width: 800, height: 600 })
    expect(fitWithin(1000, 2000)).toEqual({ width: 400, height: 800 })
  })

  it('förstorar aldrig små bilder', () => {
    expect(fitWithin(300, 200)).toEqual({ width: 300, height: 200 })
  })
})

describe('dataUrlBytes', () => {
  it('räknar base64-delen', () => {
    expect(dataUrlBytes('data:image/webp;base64,AAAA')).toBe(3)
  })
})

describe('compressImage', () => {
  it('ger WebP med kvalitet 0,8 i max 800 px när bilden ryms', async () => {
    const encode = fakeEncoder(0.1)
    const result = await compressImage(png, { decode: decodeAs(4000, 3000), encode })
    expect(result.startsWith('data:image/webp')).toBe(true)
    expect(encode).toHaveBeenCalledTimes(1)
    expect(encode.mock.calls[0]!.slice(1)).toEqual([{ width: 800, height: 600 }, 'image/webp', 0.8])
  })

  it('sänker kvaliteten och sedan storleken tills bilden ryms i ~80 kB', async () => {
    const encode = fakeEncoder(0.5)
    const result = await compressImage(png, { decode: decodeAs(800, 800), encode })
    expect(dataUrlBytes(result)).toBeLessThanOrEqual(TARGET_BYTES)
    const qualities = encode.mock.calls.map((call) => call[3])
    expect(qualities.slice(0, 4)).toEqual([0.8, 0.7, 0.6, 0.5])
    const last = encode.mock.calls.at(-1)!
    expect(last[1].width).toBeLessThan(800)
  })

  it('ger JPEG i webbläsare som inte kan koda WebP', async () => {
    const result = await compressImage(png, { decode: decodeAs(400, 300), encode: fakeEncoder(0.1, false) })
    expect(result.startsWith('data:image/jpeg')).toBe(true)
  })

  it('nekar filer som inte är bilder', async () => {
    await expect(compressImage(new Blob(['x'], { type: 'text/plain' }), { encode: fakeEncoder(0.1) })).rejects.toThrow(
      'Filen är ingen bild.',
    )
  })

  it('ger ett begripligt fel när bilden inte går att läsa', async () => {
    const decode = () => Promise.reject(new Error('trasig'))
    await expect(compressImage(png, { decode, encode: fakeEncoder(0.1) })).rejects.toThrow('Bilden gick inte att läsa in.')
  })
})

describe('imageFromLink', () => {
  const compress = { decode: decodeAs(1200, 900), encode: fakeEncoder(0.1) }

  it('hämtar och komprimerar bilden när sajten tillåter det', async () => {
    const fetch = vi.fn(async () => new Response(png, { headers: { 'content-type': 'image/png' } }))
    const result = await imageFromLink(' https://example.com/glogg.png ', { ...compress, fetch })
    expect(fetch).toHaveBeenCalledWith('https://example.com/glogg.png', expect.objectContaining({ mode: 'cors' }))
    expect(result.kind).toBe('compressed')
    if (result.kind === 'compressed') expect(result.dataUrl.startsWith('data:image/webp')).toBe(true)
  })

  it('sparar länken när sajten blockerar hämtningen (CORS)', async () => {
    const fetch = vi.fn(() => Promise.reject(new TypeError('Failed to fetch')))
    const probe = vi.fn(() => Promise.resolve())
    const result = await imageFromLink('https://example.com/glogg.jpg', { ...compress, fetch, probe })
    expect(result).toEqual({ kind: 'link', url: 'https://example.com/glogg.jpg' })
    expect(probe).toHaveBeenCalledWith('https://example.com/glogg.jpg')
  })

  it('nekar länkar som inte går att visa alls', async () => {
    const fetch = vi.fn(() => Promise.reject(new TypeError('Failed to fetch')))
    const probe = () => Promise.reject(new Error('404'))
    await expect(imageFromLink('https://example.com/finns-inte.jpg', { fetch, probe })).rejects.toThrow(
      'Bilden gick inte att läsa in.',
    )
  })

  it('nekar annat än https-länkar', async () => {
    await expect(imageFromLink('http://example.com/a.jpg')).rejects.toThrow('https://')
    await expect(imageFromLink('glogg.jpg')).rejects.toThrow('https://')
  })

  it('nekar svar som inte är bilder', async () => {
    const fetch = vi.fn(async () => new Response('<html>', { headers: { 'content-type': 'text/html' } }))
    await expect(imageFromLink('https://example.com/sida', { ...compress, fetch })).rejects.toThrow('inte på en bild')
    const notFound = vi.fn(async () => new Response('', { status: 404 }))
    await expect(imageFromLink('https://example.com/a.jpg', { ...compress, fetch: notFound })).rejects.toThrow('404')
  })
})
