import { useEffect, useState, type ReactNode } from 'react'
import { subscribeServerTimeOffset } from '../data'
import { quizTiming } from '../live'
import type { EventConfig, LiveState } from '../types'
import { Quiz } from './Quiz'

/** Frågans nummer i hela quizet (1, 2, …), i `order`. */
export function questionNumber(config: EventConfig | null, qId: string): number {
  const ids = Object.entries(config?.questions ?? {})
    .sort(([a, x], [b, y]) => x.order - y.order || (a < b ? -1 : 1))
    .map(([id]) => id)
  return ids.indexOf(qId) + 1
}

type Mode = 'none' | 'listen' | 'question' | 'timeup'

type Props = {
  eventId: string
  uid: string
  config: EventConfig | null
  live: LiveState | null
}

/**
 * Quizfrågan som lager över gästens sida (#58). Sidan under ligger kvar, så
 * gästen hamnar där hen var och ett påbörjat betyg finns kvar.
 *
 * - Låten spelar: *Lyssna noga …*
 * - Frågan är öppen: frågan. *Till provningen* stänger lagret, och en flytande
 *   ruta *Ny quizfråga!* öppnar det igen så länge tiden går.
 * - Tiden är ute (eller admin stängde frågan): *Tiden är ute!* ligger kvar
 *   tills gästen går *Till provningen*, eller tills nästa låt eller fråga börjar.
 *   Inga automatiska sidbyten.
 */
export function useQuizLayer({ eventId, uid, config, live }: Props): { open: boolean; layer: ReactNode; pill: ReactNode } {
  const [offset, setOffset] = useState(0)
  const [now, setNow] = useState(() => Date.now())
  // Lagret som gästen har stängt med Till provningen.
  const [dismissed, setDismissed] = useState<string | null>(null)

  useEffect(() => subscribeServerTimeOffset(setOffset), [])
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 250)
    return () => window.clearInterval(timer)
  }, [])

  const quiz = live?.stage === 'evening' ? live.quiz : undefined
  const qId = quiz?.qId
  const timing = quizTiming(live)
  // Samma nyckel för frågan medan den är öppen och när tiden är ute, så att en
  // stängd fråga inte öppnas igen bara för att visa Tiden är ute.
  const key = quiz?.state === 'playing' ? `playing:${qId}` : `${qId}:${timing?.openedAt ?? ''}`
  const msLeft = timing ? timing.openedAt + timing.durationMs - (now + offset) : 0
  const ended = !!qId && !!timing && (quiz?.state === 'closed' || (quiz?.state === 'open' && msLeft <= 0))

  let mode: Mode = 'none'
  if (qId && quiz?.state === 'playing') mode = 'listen'
  else if (qId && quiz?.state === 'open' && timing && msLeft > 0) mode = 'question'
  else if (ended) mode = 'timeup'

  const open = mode !== 'none' && dismissed !== key
  const layer =
    open && live ? (
      <div className="quiz-layer" role="dialog" aria-modal="true" aria-label="Musikquiz">
        <Quiz eventId={eventId} uid={uid} config={config} live={live} onLeave={() => setDismissed(key)} />
      </div>
    ) : null

  const seconds = Math.max(0, Math.ceil(msLeft / 1000))
  const pill =
    mode === 'question' && !open && qId ? (
      <button type="button" className="quiz-pill" onClick={() => setDismissed(null)}>
        <span className="quiz-pill__eq" aria-hidden="true">
          <span />
          <span />
          <span />
          <span />
        </span>
        <span className="quiz-pill__text">
          <span className="quiz-pill__title">Ny quizfråga!</span>
          <span className="quiz-pill__meta">
            Fråga {questionNumber(config, qId)} · {seconds} s kvar
          </span>
        </span>
        <span className="quiz-pill__answer">Svara</span>
      </button>
    ) : null

  return { open, layer, pill }
}
