import { useEffect, useState } from 'react'
import { loadResultsInput, writeResults, type ResultsInput } from '../data'
import { gloggOfEvening, score } from '../scoring'
import type { EventConfig, Guest, LiveState } from '../types'
import { Button } from '../ui'
import { CLASS_LABEL, CLASSES } from './preparation'
import { startChanges, stepChanges, stepLabel, TOP, type RevealStep } from './reveal'
import './reveal.css'

type Props = {
  eventId: string
  config: EventConfig | null
  live: LiveState | null
  guests: Record<string, Guest> | null
  disabled: boolean
  save: (write: () => Promise<void>) => Promise<boolean>
}

/**
 * Admin – avslöja topplistan (docs/design/AdminTopplista.dc.html). Hela listan
 * räknas här och hålls i minnet och i secret/leaderboard; gästerna får raderna
 * en i taget, i samma takt som admin trycker.
 */
export function RevealPanel({ eventId, config, live, guests, disabled, save }: Props) {
  const [input, setInput] = useState<ResultsInput | null>(null)
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    let active = true
    loadResultsInput(eventId)
      .then((loaded) => {
        if (active) setInput(loaded)
      })
      .catch(() => {
        if (active) setFailed(true)
      })
    return () => {
      active = false
    }
  }, [eventId])

  if (failed) return <p className="form-error">Kunde inte hämta svaren. Ladda om sidan.</p>
  if (!input || !guests) return <p className="muted">Räknar ut topplistan…</p>

  // Samma indata ger samma lista, så en omladdning mitt i avslöjandet hamnar rätt.
  const rows = score(input.answers, input.correct, input.quizTimes, guests)
  const glogg = gloggOfEvening(input.ratings, guests, config?.criteria, input.numbers)
  const step = (live?.reveal?.step ?? null) as RevealStep | null
  const top = rows.slice(0, TOP)
  const rest = rows.slice(TOP)

  function next() {
    if (step === null) void save(() => writeResults(eventId, startChanges(rows)))
    else if (step < TOP) void save(() => writeResults(eventId, stepChanges(rows, (step + 1) as Exclude<RevealStep, 0>, glogg)))
  }

  const nextLabel = step === null ? 'Visa plats 5 och nedåt' : step < TOP ? stepLabel((step + 1) as Exclude<RevealStep, 0>) : null

  return (
    <div className="reveal-panel">
      <p className="muted">Gästernas mobiler avslöjas i samma takt.</p>
      <div className="reveal-panel__body">
        <section className="reveal-top" aria-label="Topp 4">
          <span className="eyebrow">Topp 4</span>
          {top.map((row, i) => {
            // Plats i+1 avslöjas i steg TOP − i.
            const revealAt = TOP - i
            const shown = step !== null && step >= revealAt
            return (
              <div key={row.uid} className={`reveal-top__row${shown ? ' reveal-top__row--shown' : ''}${i === 0 ? ' reveal-top__row--winner' : ''}`}>
                <span className="reveal-top__badge">{row.rank}</span>
                {shown ? (
                  <span className="reveal-top__text">
                    <strong className="reveal-top__name">{row.name}</strong>
                    <span className="muted">
                      {row.points} poäng · {row.stars} stjärnor
                    </span>
                  </span>
                ) : (
                  <span className="reveal-top__text">
                    <strong className="reveal-top__name">?</strong>
                    <span className="muted">Avslöjas i steg {revealAt}</span>
                  </span>
                )}
              </div>
            )
          })}
        </section>

        <section className="reveal-rest" aria-label="Plats 5 och nedåt">
          <span className="eyebrow">
            Plats {TOP + 1}–{rows.length} · {step === null ? 'visas först' : 'visas nu'} · lika poäng: flest stjärnor går före
          </span>
          {rest.length === 0 ? (
            <p className="muted">Inga fler gäster.</p>
          ) : (
            <ol className="reveal-rest__list">
              {rest.map((row) => (
                <li key={row.uid} className="reveal-rest__row">
                  <span className="reveal-rest__pos">{row.rank}</span>
                  <span className="reveal-rest__name">{row.name}</span>
                  <span className="reveal-rest__points">{row.points} p</span>
                </li>
              ))}
            </ol>
          )}

          {step === TOP && (
            <div className="reveal-glogg">
              <span className="eyebrow">Kvällens glögg</span>
              {CLASSES.map((c) => {
                const winner = glogg[c]
                if (!winner) return null
                return (
                  <span key={c}>
                    {CLASS_LABEL[c]}: <strong>{config?.gloggs?.[winner.gId]?.name ?? winner.gId}</strong> ·{' '}
                    {winner.avg.toLocaleString('sv-SE', { maximumFractionDigits: 1 })}
                  </span>
                )
              })}
            </div>
          )}
        </section>
      </div>

      {nextLabel ? (
        <Button size="large" block disabled={disabled} onClick={next}>
          {nextLabel}
        </Button>
      ) : (
        <p className="quiz-panel__done">Hela topplistan och Kvällens glögg är avslöjade. Grattis till vinnaren!</p>
      )}
    </div>
  )
}
