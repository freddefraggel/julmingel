import { useId, useRef, useState, type FormEvent } from 'react'
import { removeAsset, saveAsset } from '../data'
import { compressImage, imageFromLink } from './images'
import './image-field.css'

export const CORS_WARNING =
  'Sajten tillåter inte att bilden hämtas, så länken sparades som den är och laddas från sajten under kvällen. Ladda hellre ned bilden och ladda upp den här.'

type Props = {
  eventId: string
  /** Nuvarande bild, eller undefined. */
  imageId?: string
  /** assets[imageId]: data-URL eller länk, för förhandsvisningen. */
  src?: string
  /** Vad bilden hör till, t.ex. "glögg 1" eller "svar A". */
  label: string
  /** compact: bildknapp i glögglistan. answer: miniatyr, länkfält och uppladdning för ett bildsvar. */
  variant?: 'compact' | 'answer'
  /** Anropas med nya imageId när bilden är sparad. Den gamla bilden tas bort efteråt. */
  onChange: (imageId: string) => void | Promise<void>
}

type Status = { kind: 'idle' } | { kind: 'working' } | { kind: 'warning' | 'error'; message: string }

/**
 * Bild till en glögg eller ett bildsvar. En vald fil eller länk komprimeras till WebP
 * och sparas i assets/. Blockerar sajten hämtningen sparas länken och admin får en varning.
 */
export function ImageField({ eventId, imageId, src, label, variant = 'compact', onChange }: Props) {
  const fileInput = useRef<HTMLInputElement>(null)
  const messageId = useId()
  const [link, setLink] = useState('')
  const [status, setStatus] = useState<Status>({ kind: 'idle' })
  const working = status.kind === 'working'
  const isLink = !!src && !src.startsWith('data:')

  async function store(produce: () => Promise<{ value: string; warning?: string }>) {
    setStatus({ kind: 'working' })
    try {
      const { value, warning } = await produce()
      const newId = await saveAsset(eventId, value)
      await onChange(newId)
      if (imageId && imageId !== newId) removeAsset(eventId, imageId).catch(() => {})
      setLink('')
      setStatus(warning ? { kind: 'warning', message: warning } : { kind: 'idle' })
    } catch (error) {
      setStatus({ kind: 'error', message: error instanceof Error ? error.message : 'Bilden kunde inte sparas.' })
    }
  }

  function onFile(file: File | undefined) {
    if (fileInput.current) fileInput.current.value = ''
    if (file) void store(async () => ({ value: await compressImage(file) }))
  }

  function onLink(event: FormEvent) {
    event.preventDefault()
    if (!link.trim() || working) return
    void store(async () => {
      const result = await imageFromLink(link)
      return result.kind === 'compressed' ? { value: result.dataUrl } : { value: result.url, warning: CORS_WARNING }
    })
  }

  const message =
    status.kind === 'warning' || status.kind === 'error' ? (
      <span id={messageId} role={status.kind === 'error' ? 'alert' : 'status'} className={`image-field__message image-field__message--${status.kind}`}>
        {status.message}
      </span>
    ) : null

  const file = (
    <input
      ref={fileInput}
      type="file"
      accept="image/*"
      hidden
      data-testid={`fil för ${label}`}
      onChange={(event) => onFile(event.target.files?.[0])}
    />
  )

  if (variant === 'compact') {
    return (
      <span className="image-field image-field--compact">
        <button
          type="button"
          className="image-field__pick"
          aria-label={`Ladda upp bild för ${label}`}
          aria-describedby={message ? messageId : undefined}
          aria-busy={working}
          disabled={working}
          title={isLink ? 'Länkad bild, laddas från sajten under kvällen' : undefined}
          onClick={() => fileInput.current?.click()}
        >
          {src ? <img src={src} alt="" /> : <ImageIcon />}
        </button>
        {file}
        {message}
      </span>
    )
  }

  return (
    <div className="image-field image-field--answer">
      <div className="image-field__thumb">
        {src ? (
          <img src={src} alt={`Bild för ${label}`} />
        ) : (
          <>
            <ImageIcon />
            <span>{working ? 'Komprimerar …' : 'Ingen bild än'}</span>
          </>
        )}
      </div>
      <form className="image-field__row" onSubmit={onLink}>
        <input
          type="url"
          aria-label={`Bildlänk för ${label}`}
          placeholder="Klistra in bildlänk"
          value={link}
          disabled={working}
          onChange={(event) => setLink(event.target.value)}
          onBlur={onLink}
        />
        <button
          type="button"
          className="image-field__upload"
          aria-label={`Ladda upp bild för ${label}`}
          disabled={working}
          onClick={() => fileInput.current?.click()}
        >
          <svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 16V4M7 9l5-5 5 5M5 20h14" />
          </svg>
        </button>
        {file}
      </form>
      {message ?? (isLink && <span className="image-field__message image-field__message--warning">Länkad bild, inte sparad i databasen.</span>)}
    </div>
  )
}

function ImageIcon() {
  return (
    <svg aria-hidden="true" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="4" width="18" height="16" rx="2" />
      <circle cx="9" cy="10" r="2" />
      <path d="M21 16l-5-5-9 9" />
    </svg>
  )
}
