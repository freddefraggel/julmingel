import QRCode from 'qrcode'
import { useEffect, useRef, useState } from 'react'
import { Button } from '../ui'
import { guestUrl } from './guestUrl'

type Props = {
  eventId: string
  joinCode: string
  joinOpen: boolean
  onClose: () => void
}

/** Stor QR-kod med gästlänken, att visa på admin-skärmen när gästerna kommer. */
export function QrDialog({ eventId, joinCode, joinOpen, onClose }: Props) {
  const url = guestUrl(eventId, joinCode)
  const [svg, setSvg] = useState<string | null>(null)
  const dialogRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    let active = true
    // Svart på vitt (standard) skannas säkrast. Ritas lokalt, utan nätverksanrop.
    QRCode.toString(url, { type: 'svg', margin: 2, errorCorrectionLevel: 'M' })
      .then((result) => {
        if (active) setSvg(result)
      })
      .catch(() => {
        if (active) setSvg(null)
      })
    return () => {
      active = false
    }
  }, [url])

  useEffect(() => {
    dialogRef.current?.focus()
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [onClose])

  return (
    <div className="qr-backdrop" onClick={onClose}>
      <div
        ref={dialogRef}
        className="qr-dialog"
        role="dialog"
        tabIndex={-1}
        aria-modal="true"
        aria-labelledby="qr-title"
        onClick={(event) => event.stopPropagation()}
      >
        <h2 id="qr-title">Skanna för att gå med</h2>
        <div className="qr-dialog__code">
          {svg ? (
            <img src={`data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`} alt={`QR-kod till ${url}`} />
          ) : (
            <span className="muted">Ritar QR-koden…</span>
          )}
        </div>
        <p className="qr-dialog__url">{url}</p>
        {!joinOpen && (
          <p role="alert" className="form-error">
            Registreringen är stängd. Öppna den för att släppa in nya gäster.
          </p>
        )}
        <Button variant="secondary" onClick={onClose}>
          Stäng
        </Button>
      </div>
    </div>
  )
}
