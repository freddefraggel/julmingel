import QRCode from 'qrcode'
import { useEffect, useMemo, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { openAdminEvent, subscribeConfig } from '../data'
import { Garland, Snow } from '../ui'
import { readAdminEventId } from './adminEvent'
import { guestUrl } from './guestUrl'
import './qr.css'

const STEPS = ['Scanna koden med kameran', 'Skriv ditt namn', 'Välj vanlig eller alkoholfri provning'] as const

/** QR-koden som SVG, ritad lokalt utan nätverksanrop. Svart på vitt skannas säkrast. */
export function useQrSvg(url: string | null): string | null {
  const [svg, setSvg] = useState<string | null>(null)
  useEffect(() => {
    if (!url) return
    let active = true
    QRCode.toString(url, { type: 'svg', margin: 1, errorCorrectionLevel: 'M' })
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
  return svg
}

type State = { kind: 'loading' } | { kind: 'failed' } | { kind: 'ready'; eventId: string; joinCode: string }

/**
 * Välkomstskärmen med QR-koden (#/admin/qr, docs/design/QRSkarm.dc.html) och
 * A4-affischen för utskrift (#/admin/qr/print, QRA4.dc.html). Koden är samma
 * gästlänk som i kontrollpanelen, med kvällens joinCode.
 */
export default function QrWelcome({ print = false }: { print?: boolean }) {
  const { search } = useLocation()
  const eventId = useMemo(() => readAdminEventId(search), [search])
  const [state, setState] = useState<State>({ kind: 'loading' })
  const [joinOpen, setJoinOpen] = useState<boolean | null>(null)
  const [eventName, setEventName] = useState<string | null>(null)

  useEffect(() => {
    if (!eventId) return
    let active = true
    openAdminEvent(eventId).then((result) => {
      if (!active) return
      setState(result.ok ? { kind: 'ready', eventId, joinCode: result.joinCode } : { kind: 'failed' })
    })
    const unsubscribe = subscribeConfig(eventId, (config) => {
      setJoinOpen(config?.joinOpen === true)
      setEventName(config?.name?.trim() || null)
    })
    return () => {
      active = false
      unsubscribe()
    }
  }, [eventId])

  const url = state.kind === 'ready' ? guestUrl(state.eventId, state.joinCode) : null
  const svg = useQrSvg(url)

  if (!eventId || state.kind === 'failed') {
    return (
      <main className="page page--admin admin-center">
        <p className="form-error" role="alert">
          {eventId ? 'Kunde inte hämta kvällen.' : 'Välj först vilken kväll det gäller.'}{' '}
          <Link to="/admin">Till kontrollpanelen</Link>
        </p>
      </main>
    )
  }

  const code = (
    <div className="qr-welcome__code" role="img" aria-label="QR-kod till kvällens sida">
      {svg ? <img src={`data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`} alt="" /> : <span>Ritar QR-koden…</span>}
    </div>
  )

  // Bara för admin: syns inte på utskriften och är diskret på skärmen.
  const closedWarning = joinOpen === false && (
    <p className="qr-welcome__warning no-print" role="alert">
      Registreringen är stängd – koden släpper inte in någon. Öppna den i kontrollpanelen.
    </p>
  )

  if (print) {
    return (
      <main className="qr-print">
        <div className="qr-print__tools no-print">
          <Link to="/admin/qr" className="btn btn--secondary btn--small">
            Tillbaka
          </Link>
          <button type="button" className="btn btn--primary btn--small" onClick={() => window.print()}>
            Skriv ut
          </button>
          {closedWarning}
        </div>
        <section className="qr-print__sheet">
          <span className="qr-print__brand">{eventName ?? 'Glöggmingel'}</span>
          <h1>
            Välkommen in <br />i värmen!
          </h1>
          <div className="candy qr-print__candy" aria-hidden="true" />
          <p className="qr-print__lead">Ta en kopp glögg och var med i kvällens glöggprovning och musikquiz.</p>
          {code}
          <ol className="qr-print__steps">
            {['Scanna koden med kameran', 'Skriv ditt namn', 'Välj vanlig eller alkoholfri'].map((step, i) => (
              <li key={step}>
                <span className="qr-step__number">{i + 1}</span>
                <span>{step}</span>
              </li>
            ))}
          </ol>
          <span className="qr-print__end">God jul!</span>
        </section>
      </main>
    )
  }

  return (
    <main className="qr-welcome">
      <Garland />
      <Snow />
      <section className="qr-welcome__text">
        <span className="qr-welcome__brand">{eventName ?? 'Glöggmingel'}</span>
        <h1>Välkommen in i värmen!</h1>
        <div className="candy qr-welcome__candy" aria-hidden="true" />
        <p className="qr-welcome__lead">Ta en kopp glögg och var med i kvällens glöggprovning och musikquiz.</p>
        <ol className="qr-welcome__steps">
          {STEPS.map((step, i) => (
            <li key={step}>
              <span className="qr-step__number">{i + 1}</span>
              <span>{step}</span>
            </li>
          ))}
        </ol>
      </section>
      <section className="qr-welcome__side">
        {code}
        <span className="qr-welcome__scan">Scanna för att vara med</span>
      </section>
      <nav className="qr-welcome__tools no-print" aria-label="Admin">
        <Link to="/admin">Till kontrollpanelen</Link>
        <Link to="/admin/qr/print">Skriv ut som A4</Link>
        {closedWarning}
      </nav>
    </main>
  )
}
