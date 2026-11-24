// Bildhantering för Förbered kvällen (docs/spec.md, Bilder).
// Firebase Storage kräver Blaze, så bilderna komprimeras i webbläsaren och sparas
// som data-URL i assets/{imageId}. Går en länk inte att hämta (CORS) sparas länken som den är.

/** Längsta sidan efter skalning. */
export const MAX_SIDE = 800
/** Målstorlek för en bild. Kvaliteten och sedan storleken sänks tills bilden ryms. */
export const TARGET_BYTES = 80_000
/** Övre gräns för ett värde i assets/, samma som i databasreglerna. */
export const MAX_ASSET_LENGTH = 200_000

const QUALITIES = [0.8, 0.7, 0.6, 0.5]
const SHRINK = 0.75
const MIN_SIDE = 200

type Size = { width: number; height: number }

/** Bild som går att rita på en canvas. */
export type Decoded = { source: CanvasImageSource; width: number; height: number; close?: () => void }

/** Ritar bilden i given storlek och returnerar en data-URL. */
export type Encoder = (image: Decoded, size: Size, type: string, quality: number) => string

/** Skalar ned så att längsta sidan blir högst `max`. Förstorar aldrig. */
export function fitWithin(width: number, height: number, max = MAX_SIDE): Size {
  const scale = Math.min(1, max / Math.max(width, height))
  return { width: Math.max(1, Math.round(width * scale)), height: Math.max(1, Math.round(height * scale)) }
}

/** Ungefärligt antal byte som en base64-data-URL motsvarar. */
export function dataUrlBytes(dataUrl: string): number {
  const base64 = dataUrl.slice(dataUrl.indexOf(',') + 1)
  return Math.floor((base64.length * 3) / 4)
}

const canvasEncode: Encoder = (image, { width, height }, type, quality) => {
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const context = canvas.getContext('2d')
  if (!context) throw new Error('Webbläsaren kan inte rita bilden.')
  context.drawImage(image.source, 0, 0, width, height)
  return canvas.toDataURL(type, quality)
}

async function decodeBlob(blob: Blob): Promise<Decoded> {
  if (typeof createImageBitmap === 'function') {
    try {
      const bitmap = await createImageBitmap(blob)
      return { source: bitmap, width: bitmap.width, height: bitmap.height, close: () => bitmap.close() }
    } catch {
      // Prova med <img> nedan, som klarar fler format i vissa webbläsare.
    }
  }
  const url = URL.createObjectURL(blob)
  try {
    const img = await loadImage(url)
    return { source: img, width: img.naturalWidth, height: img.naturalHeight }
  } finally {
    URL.revokeObjectURL(url)
  }
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = () => reject(new Error('Bilden gick inte att läsa in.'))
    img.src = src
  })
}

export type CompressDeps = {
  decode?: (blob: Blob) => Promise<Decoded>
  encode?: Encoder
}

/**
 * Fil eller hämtad bild → max 800 px → WebP med kvalitet 0,8, ~80 kB.
 * Blir bilden för stor sänks kvaliteten och sedan storleken. Webbläsare utan
 * WebP-kodning (äldre Safari) ger JPEG i stället.
 */
export async function compressImage(blob: Blob, deps: CompressDeps = {}): Promise<string> {
  const { decode = decodeBlob, encode = canvasEncode } = deps
  if (blob.type && !blob.type.startsWith('image/')) throw new Error('Filen är ingen bild.')

  let image: Decoded
  try {
    image = await decode(blob)
  } catch {
    throw new Error('Bilden gick inte att läsa in.')
  }

  try {
    let type = 'image/webp'
    let size = fitWithin(image.width, image.height)
    let smallest: string | null = null
    for (;;) {
      for (const quality of QUALITIES) {
        let dataUrl = encode(image, size, type, quality)
        if (!dataUrl.startsWith(`data:${type}`) && type === 'image/webp') {
          type = 'image/jpeg'
          dataUrl = encode(image, size, type, quality)
        }
        if (!smallest || dataUrl.length < smallest.length) smallest = dataUrl
        if (dataUrlBytes(dataUrl) <= TARGET_BYTES) return dataUrl
      }
      if (Math.max(size.width, size.height) <= MIN_SIDE) break
      size = fitWithin(size.width, size.height, Math.round(Math.max(size.width, size.height) * SHRINK))
    }
    if (smallest && smallest.length <= MAX_ASSET_LENGTH) return smallest
    throw new Error('Bilden blev för stor även efter komprimering.')
  } finally {
    image.close?.()
  }
}

export type LinkResult =
  /** Bilden hämtades och komprimerades: spara data-URL:en. */
  | { kind: 'compressed'; dataUrl: string }
  /** Sajten blockerar hämtningen (CORS): spara länken och varna admin. */
  | { kind: 'link'; url: string }

export type LinkDeps = CompressDeps & {
  fetch?: typeof fetch
  /** Kontrollerar att länken går att visa som bild, utan CORS. */
  probe?: (url: string) => Promise<unknown>
}

/** Försöker hämta bilden bakom en länk och komprimera den som en uppladdad fil. */
export async function imageFromLink(link: string, deps: LinkDeps = {}): Promise<LinkResult> {
  const { fetch: fetchFn = fetch, probe = loadImage, ...compress } = deps
  const url = link.trim()
  if (!/^https:\/\/\S+$/i.test(url)) throw new Error('Länken måste börja med https://')

  let response: Response
  try {
    response = await fetchFn(url, { mode: 'cors', credentials: 'omit' })
  } catch {
    // fetch säger inte varför, men en bildlänk som inte går att hämta är nästan alltid CORS.
    // Länken sparas om den går att visa som vanlig <img>.
    try {
      await probe(url)
    } catch {
      throw new Error('Bilden gick inte att läsa in. Kontrollera länken.')
    }
    return { kind: 'link', url }
  }

  if (!response.ok) throw new Error(`Kunde inte hämta bilden (${response.status}).`)
  const blob = await response.blob()
  const type = blob.type || response.headers.get('content-type') || ''
  if (type && !type.startsWith('image/')) throw new Error('Länken pekar inte på en bild.')
  return { kind: 'compressed', dataUrl: await compressImage(blob, compress) }
}
