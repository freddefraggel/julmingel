import { useEffect, useState } from 'react'
import { subscribeOwnGuess, subscribeResults, subscribeReveal } from '../data'
import type { EventConfig, EventResults, EventReveal, Guess, GuestClass, LeaderboardEntry } from '../types'
import { Garland } from '../ui'
import { BackButton } from './BackButton'
import { cleanMap, guessScore } from './Guess'

const TOP = 4
const CLASSES: readonly GuestClass[] = ['vanlig', 'alkfri']
const CLASS_LABEL: Record<GuestClass, string> = { vanlig: 'Vanlig', alkfri: 'Alkoholfri' }
const byName = new Intl.Collator('sv').compare

type Row = LeaderboardEntry & { uid: string }

/** Raderna i results/leaderboard i placeringsordning. */
export function sortedRows(leaderboard: EventResults['leaderboard']): Row[] {
  return Object.entries(leaderboard ?? {})
    .map(([uid, e]) => ({ uid, ...e }))
    .sort((a, b) => a.rank - b.rank || b.points - a.points || b.stars - a.stars || byName(a.name ?? '', b.name ?? ''))
}

type Props = {
  eventId: string
  uid: string
  guestClass: GuestClass
  config: EventConfig | null
  /** `live/reveal/step`, eller null när avslöjandet inte har börjat. */
  step: number | null
  /** Efter kvällen: hela listan, Kvällens glögg och Dina gissningar. */
  final: boolean
  onBack?: () => void
}

/**
 * 7b. Topplistan avslöjas och 7c. Topplista. Mobilen visar bara det som admin
 * har skrivit till results/, så topp 4 dyker upp i samma takt som hos admin.
 */
export function Leaderboard({ eventId, uid, guestClass, config, step, final, onBack }: Props) {
  const [results, setResults] = useState<EventResults>({})
  const [reveal, setReveal] = useState<EventReveal>({})
  const [guess, setGuess] = useState<Guess | null>(null)

  useEffect(() => {
    const unsubscribers = [
      subscribeResults(eventId, setResults),
      subscribeReveal(eventId, setReveal),
      subscribeOwnGuess(eventId, uid, setGuess),
    ]
    return () => unsubscribers.forEach((unsubscribe) => unsubscribe())
  }, [eventId, uid])

  const rows = sortedRows(results.leaderboard)
  const done = final || step === TOP
  const hidden = step === null || done ? 0 : TOP - step
  const revealedNumbers = reveal.numbers?.[guestClass] ? cleanMap(reveal.numbers[guestClass]) : null
  const guessed = revealedNumbers && guess ? guessScore(cleanMap(guess.map), revealedNumbers) : null

  return (
    <main className="page guest-page leaderboard">
      <Garland />
      {onBack && <BackButton onClick={onBack} />}
      <div className="leaderboard__head">
        <span className="eyebrow eyebrow--gold">{done ? 'Kvällens resultat' : 'Musikquiz'}</span>
        <h1>Topplista</h1>
        <div className="candy" aria-hidden="true" />
      </div>

      {done && results.gloggOfEvening && (
        <section className="leaderboard__glogg" aria-label="Kvällens glögg">
          <span className="eyebrow">Kvällens glögg</span>
          {CLASSES.map((c) => {
            const winner = results.gloggOfEvening?.[c]
            if (!winner) return null
            const number = Object.entries(cleanMap(reveal.numbers?.[c])).find(([, gId]) => gId === winner.gId)?.[0]
            const name = config?.gloggs?.[winner.gId]?.name ?? 'Okänd glögg'
            return (
              <div key={c} className="leaderboard__glogg-row">
                <span className="leaderboard__glogg-number">{number ?? '?'}</span>
                <span className="leaderboard__glogg-text">
                  <span className="leaderboard__glogg-class">{CLASS_LABEL[c]}</span>
                  <strong>
                    {name} · {winner.avg.toLocaleString('sv-SE', { maximumFractionDigits: 1 })}
                  </strong>
                </span>
              </div>
            )
          })}
        </section>
      )}

      {step === null && rows.length === 0 ? (
        <div className="quiz-wait">
          <h2>Snart dags!</h2>
          <p className="muted">Quizledaren avslöjar topplistan. Håll i glöggen.</p>
        </div>
      ) : (
        <section aria-label={done ? 'Musikquiz · poäng' : 'Topplistan'}>
          {done && <span className="eyebrow">Musikquiz · poäng</span>}
          <ol className="leaderboard__list">
            {Array.from({ length: hidden }, (_, i) => (
              <li key={`hidden-${i}`} className="leaderboard__row leaderboard__row--hidden">
                <span className="leaderboard__pos">{i + 1}</span>
                <span className="leaderboard__name">?</span>
              </li>
            ))}
            {rows.map((row) => {
              const classes = ['leaderboard__row']
              if (row.rank <= TOP) classes.push('leaderboard__row--top')
              if (row.rank === 1) classes.push('leaderboard__row--winner')
              if (row.uid === uid) classes.push('leaderboard__row--me')
              return (
                <li key={row.uid} className={classes.join(' ')} aria-current={row.uid === uid ? 'true' : undefined}>
                  <span className="leaderboard__pos">{row.rank}</span>
                  <span className="leaderboard__name">
                    {row.name}
                    {row.uid === uid && <span className="leaderboard__you"> · du</span>}
                  </span>
                  <span className="leaderboard__points">{row.points} p</span>
                </li>
              )
            })}
          </ol>
        </section>
      )}

      {done && guessed && (
        <section className="leaderboard__guess" aria-label="Dina gissningar">
          <strong>Dina gissningar</strong>
          <span className="muted">
            Du gissade {guessed.right} av {guessed.total} rätt
            {guessed.total > 0 && guessed.right / guessed.total >= 0.5 ? ' – snyggt!' : '.'}
          </span>
        </section>
      )}
    </main>
  )
}
