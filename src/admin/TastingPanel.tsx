import { useEffect, useState } from 'react'
import { setTasting, subscribeAllRatings, subscribeAssets, subscribeNumbers } from '../data'
import type { EventConfig, EventSecret, Guest, GuestClass, GuestRatings, LiveState, TastingState } from '../types'
import { Button, Tabs } from '../ui'
import { CLASS_LABEL, CLASSES } from './preparation'
import {
  guestsInClass,
  numberAfter,
  ratedCount,
  serve,
  STATUS_LABEL,
  tabLabel,
  tastingRows,
  type TastingRow,
} from './tasting'
import './tasting.css'

type Props = {
  eventId: string
  config: EventConfig | null
  live: LiveState | null
  guests: Record<string, Guest> | null
  disabled: boolean
  /** Kör en skrivning med kontrollpanelens felhantering. */
  save: (write: () => Promise<void>) => Promise<boolean>
}

/**
 * Admin – glöggprovning (docs/design/AdminGlogg.dc.html), per klass: vad som
 * serveras nu, vad som ska förberedas och serveringsordningen.
 */
export function TastingPanel({ eventId, config, live, guests, disabled, save }: Props) {
  const [cls, setCls] = useState<GuestClass>('vanlig')
  const [numbers, setNumbers] = useState<NonNullable<EventSecret['numbers']> | null>(null)
  const [ratings, setRatings] = useState<Record<string, GuestRatings>>({})
  const [assets, setAssets] = useState<Record<string, string>>({})

  useEffect(() => {
    const unsubscribers = [
      subscribeNumbers(eventId, setNumbers),
      subscribeAllRatings(eventId, setRatings),
      subscribeAssets(eventId, setAssets),
    ]
    return () => unsubscribers.forEach((unsubscribe) => unsubscribe())
  }, [eventId])

  const perClass = {} as Record<GuestClass, { state: TastingState | undefined; rows: TastingRow[]; uids: string[] }>
  for (const c of CLASSES) {
    const classState = live?.tasting?.[c]
    perClass[c] = {
      state: classState,
      rows: tastingRows(numbers?.[c], config?.gloggs, classState),
      uids: guestsInClass(guests, c),
    }
  }

  const { state, rows, uids } = perClass[cls]
  const serving = state?.serving ?? null
  const now = rows.find((r) => r.number === serving)
  // ”Förbered härnäst”: det admin har valt, annars nästa i ordningen.
  const nextNumber = state?.next ?? numberAfter(rows, serving)
  const next = rows.find((r) => r.number === nextNumber)
  const rated = now ? ratedCount(ratings, uids, now.number) : 0

  function serveNumber(number: number) {
    void save(() => setTasting(eventId, cls, serve(rows, number)))
  }

  function prepare(number: number) {
    void save(() => setTasting(eventId, cls, { serving, next: number }))
  }

  if (numbers === null) return <p className="muted">Hämtar serveringsordningen…</p>

  return (
    <div className="tasting">
      <Tabs
        label="Glöggprovning"
        value={cls}
        onChange={setCls}
        options={CLASSES.map((c) => ({
          value: c,
          label: tabLabel(CLASS_LABEL[c], perClass[c].rows, perClass[c].state?.serving ?? null, perClass[c].uids.length),
        }))}
      />

      {rows.length === 0 ? (
        <p className="muted">
          Inga glögger i {CLASS_LABEL[cls].toLowerCase()}. Lägg till dem under <em>Förbered kvällen</em>.
        </p>
      ) : (
        <div className="tasting__body">
          <div className="tasting__main">
            <section className="tasting-now" aria-label="Serveras nu">
              <div className="tasting-now__image">
                {now?.imageId && assets[now.imageId] ? <img src={assets[now.imageId]} alt="" /> : <MugIcon />}
              </div>
              <div className="tasting-now__text">
                <span className="eyebrow eyebrow--gold">Serveras nu</span>
                {now ? (
                  <>
                    <div className="tasting-now__title">
                      <span className="tasting-now__number">Nr {now.number}</span>
                      <span className="tasting-now__name">{now.name}</span>
                    </div>
                    {now.description && <span className="muted">{now.description}</span>}
                    <div className="tasting-now__spacer" />
                    <div className="tasting-now__rated">
                      <span className="muted">Har rankat</span>
                      <strong>
                        {rated} av {uids.length}
                      </strong>
                    </div>
                    <div className="tasting-now__bar" aria-hidden="true">
                      <div style={{ width: `${uids.length ? (rated / uids.length) * 100 : 0}%` }} />
                    </div>
                  </>
                ) : (
                  <span className="tasting-now__name">Inget än</span>
                )}
              </div>
            </section>

            {next && (
              <section className="tasting-next" aria-label="Förbered härnäst">
                <span className="eyebrow">Förbered härnäst</span>
                <strong className="tasting-next__name">
                  Nr {next.number} · {next.name}
                </strong>
                <span className="muted">
                  {now
                    ? `Sätt på värmen nu – häll upp när de flesta har rankat nr ${now.number}.`
                    : 'Häll upp den första glöggen och tryck på Servera när den är ute.'}
                </span>
              </section>
            )}

            {next ? (
              <Button size="large" block className="tasting__serve" disabled={disabled} onClick={() => serveNumber(next.number)}>
                <span className="tasting__serve-text">
                  <span>Servera nr {next.number}</span>
                  <span className="tasting__serve-sub">Gästernas mobiler hoppar till glögg {next.number}</span>
                </span>
              </Button>
            ) : (
              <p className="tasting__all-done">Alla glögger i {CLASS_LABEL[cls].toLowerCase()} är serverade.</p>
            )}
          </div>

          <section className="tasting-order" aria-label="Serveringsordning">
            <span className="eyebrow">Serveringsordning</span>
            <ol className="tasting-order__list">
              {rows.map((r) => (
                <li key={r.number} className={`tasting-order__row tasting-order__row--${r.status}`}>
                  <span className="tasting-order__number">{r.number}</span>
                  <span className="tasting-order__name">{r.name}</span>
                  {r.status === 'wait' || r.status === 'done' ? (
                    <button
                      type="button"
                      className="tasting-order__chip tasting-order__pick"
                      disabled={disabled}
                      aria-label={`Förbered nr ${r.number} härnäst`}
                      title="Förbered härnäst"
                      onClick={() => prepare(r.number)}
                    >
                      {STATUS_LABEL[r.status]}
                    </button>
                  ) : (
                    <span className="tasting-order__chip">{STATUS_LABEL[r.status]}</span>
                  )}
                </li>
              ))}
            </ol>
            <span className="prepare__hint">
              Ordningen ställs in under Förbered kvällen. Gästerna ser bara numren. Tryck på en status för att förbereda en annan
              glögg härnäst.
            </span>
          </section>
        </div>
      )}
    </div>
  )
}

function MugIcon() {
  return (
    <svg aria-hidden="true" width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <path d="M6 8h10v6a5 5 0 0 1-10 0z" />
      <path d="M16 9.5h1.5a2.5 2.5 0 0 1 0 5H16" />
      <path d="M9 2.5c-.6 1 .6 1.8 0 3M12.5 2.5c-.6 1 .6 1.8 0 3" />
      <path d="M5 22h12" />
    </svg>
  )
}
