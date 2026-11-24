import { useEffect, useState } from 'react'
import { revealNumbers, subscribeAllGuesses, subscribeNumbers, subscribeReveal } from '../data'
import type { EventConfig, EventReveal, EventSecret, Guess, Guest } from '../types'
import { Button } from '../ui'
import { CLASS_LABEL, CLASSES } from './preparation'
import { tastingRows } from './tasting'
import './quiz.css'
import './tasting.css'

type Props = {
  eventId: string
  config: EventConfig | null
  guests: Record<string, Guest> | null
  disabled: boolean
  save: (write: () => Promise<void>) => Promise<boolean>
}

/**
 * Admin – Gissa glöggen: hur många som har låst sina gissningar, och knappen
 * som avslöjar glöggordningen (secret/numbers → reveal/numbers).
 */
export function GuessPanel({ eventId, config, guests, disabled, save }: Props) {
  const [guesses, setGuesses] = useState<Record<string, Guess>>({})
  const [numbers, setNumbers] = useState<NonNullable<EventSecret['numbers']> | null>(null)
  const [reveal, setReveal] = useState<EventReveal>({})

  useEffect(() => {
    const unsubscribers = [
      subscribeAllGuesses(eventId, setGuesses),
      subscribeNumbers(eventId, setNumbers),
      subscribeReveal(eventId, setReveal),
    ]
    return () => unsubscribers.forEach((unsubscribe) => unsubscribe())
  }, [eventId])

  const uids = Object.keys(guests ?? {})
  const locked = uids.filter((uid) => guesses[uid]?.locked === true).length
  const started = uids.filter((uid) => guesses[uid] && !guesses[uid]!.locked).length
  const revealed = !!reveal.numbers

  function onReveal() {
    if (!numbers) return
    const waiting = uids.length - locked
    if (waiting > 0 && !window.confirm(`${waiting} ${waiting === 1 ? 'gäst har' : 'gäster har'} inte låst sina gissningar. Avslöja ändå?`)) return
    void save(() => revealNumbers(eventId, numbers))
  }

  return (
    <div className="guess-panel">
      <div className="guess-panel__count">
        <strong>
          {locked} av {uids.length} har låst sina gissningar
        </strong>
        {started > 0 && <span className="muted">{started} håller på</span>}
      </div>
      <div className="guess-panel__bar" aria-hidden="true">
        <div style={{ width: `${uids.length ? (locked / uids.length) * 100 : 0}%` }} />
      </div>

      {revealed ? (
        <p className="quiz-panel__done">Glöggordningen är avslöjad. Gästerna ser hur många de gissade rätt.</p>
      ) : (
        <Button size="large" block disabled={disabled || !numbers} onClick={onReveal}>
          Avslöja glöggordningen
        </Button>
      )}

      <div className="guess-panel__order">
        {CLASSES.map((c) => {
          const rows = tastingRows(numbers?.[c], config?.gloggs, undefined)
          if (rows.length === 0) return null
          return (
            <section key={c} aria-label={`Glöggordning ${CLASS_LABEL[c].toLowerCase()}`}>
              <span className="eyebrow">{CLASS_LABEL[c]}</span>
              <ol className="tasting-order__list">
                {rows.map((r) => (
                  <li key={r.number} className="tasting-order__row">
                    <span className="tasting-order__number">{r.number}</span>
                    <span className="tasting-order__name">{r.name}</span>
                  </li>
                ))}
              </ol>
            </section>
          )
        })}
      </div>
    </div>
  )
}
