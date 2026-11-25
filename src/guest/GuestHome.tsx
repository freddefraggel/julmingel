import type { ReactNode } from 'react'
import type { EventConfig, Guest, GuestRatings, LiveState } from '../types'
import { Garland, Snow } from '../ui'
import { questionNumber } from './QuizLayer'

/** Undersidorna som Hem länkar till. */
export type HomeTarget = 'ranka' | 'glogger' | 'gissa'

type Props = {
  guest: Guest
  /** null tills första beskedet från `live/` har kommit. */
  live: LiveState | null
  config: EventConfig | null
  ratings: GuestRatings
  onOpen?: (target: HomeTarget) => void
}

/** Kvällens tre delar på startsidan innan start (docs/design/HemStart.dc.html). */
const TONIGHT = [
  { title: 'Glöggprovning', text: 'Vi dricker glögg och du säger vad du tycker.' },
  { title: 'Musikquiz', text: 'Vem kan mest? Var redo när en ny fråga dyker upp under kvällen. Svara snabbt och korrekt!' },
  { title: 'Avslöjande', text: 'Kvällens bästa glögg koras, och vinnaren av musikquizet koras.' },
] as const

/**
 * Hur många quizfrågor som är klara, utifrån `live/quiz`: en stängd fråga är
 * klar, en som spelar, visas eller väntar är nästa.
 */
export function quizDone(config: EventConfig | null, quiz: LiveState['quiz']): number {
  if (!quiz?.qId) return 0
  const n = questionNumber(config, quiz.qId)
  if (n === 0) return 0
  return quiz.state === 'closed' ? n : n - 1
}

/**
 * 2. Hem (docs/design/Hem.dc.html och HemStart.dc.html). Bara det som går att
 * göra just nu, och inget som uppmanar gästen att sitta med mobilen.
 */
export function GuestHome({ guest, live, config, ratings, onOpen }: Props) {
  const stage = live?.stage ?? 'lobby'

  if (stage === 'lobby') {
    return (
      <main className="page guest-page home">
        <Garland />
        <Snow />
        <h1>Välkommen, {guest.name}</h1>
        <section className="home-tonight" aria-label="Ikväll">
          <span className="eyebrow">Ikväll</span>
          <ol className="home-tonight__steps">
            {TONIGHT.map((step, i) => (
              <li key={step.title} className="home-tonight__step">
                <span className="home-tonight__number">{i + 1}</span>
                <span className="home-tonight__text">
                  <strong>{step.title}</strong>
                  <span className="muted">{step.text}</span>
                </span>
              </li>
            ))}
          </ol>
        </section>
        <div className="home__spacer" />
        <p className="home-soon">Kvällen börjar snart</p>
      </main>
    )
  }

  const tasting = live?.tasting?.[guest.class]
  const total = Object.values(config?.gloggs ?? {}).filter((g) => g.class === guest.class).length
  const tried = Object.values(ratings).filter((byCriterion) => Object.keys(byCriterion ?? {}).length > 0).length
  const questions = Object.keys(config?.questions ?? {}).length
  const done = quizDone(config, live?.quiz)
  const guessing = stage === 'wrapup' && live?.wrapup?.step === 'guess'
  const serving = tasting?.serving ?? null

  return (
    <main className="page guest-page home">
      <Garland />
      <Snow />
      <header className="home__greeting">
        <span className="home__hello">God kväll</span>
        <h1>Hej {guest.name}!</h1>
      </header>

      {guessing && (
        <Card title="Gissa glöggen" accent onOpen={onOpen && (() => onOpen('gissa'))} action="Gissa nu">
          <span className="home-card__sub">Vilket nummer är vilken glögg?</span>
        </Card>
      )}

      <section className="card home-card" aria-label="Glöggprovning">
        <span className="home-card__title">Glöggprovning</span>
        {tasting?.open ? (
          <>
            <span className="home-card__sub">
              {serving !== null
                ? `Nu serveras nr ${serving} · du har rankat ${Math.min(tried, total)} av ${total}`
                : `Snart serveras första glöggen · du har rankat ${Math.min(tried, total)} av ${total}`}
            </span>
            <div className="home-card__bar" aria-hidden="true">
              <div style={{ width: `${total > 0 ? Math.min(100, (tried / total) * 100) : 0}%` }} />
            </div>
            {onOpen && (
              <button type="button" className="btn btn--primary btn--large btn--block" onClick={() => onOpen('ranka')}>
                {serving !== null ? `Ranka nr ${serving}` : 'Ranka glögg'}
              </button>
            )}
          </>
        ) : (
          <span className="home-card__sub">
            {serving !== null || tried > 0 ? 'Provningen är stängd – tack för dina betyg' : 'Glöggprovningen börjar snart'}
          </span>
        )}
        {onOpen && (
          <button type="button" className="link-button home-card__link" onClick={() => onOpen('glogger')}>
            Se kvällens glögger
          </button>
        )}
      </section>

      {stage === 'evening' && questions > 0 && (
        <p className="home-quiz">
          <NoteIcon />
          <span>
            <strong>Musikquiz</strong> ·{' '}
            {done >= questions ? 'alla frågor klara' : `${done} av ${questions} frågor klara · nästa kan komma när som helst`}
          </span>
        </p>
      )}
    </main>
  )
}

type CardProps = { title: string; accent?: boolean; onOpen?: () => void; action: string; children: ReactNode }

function Card({ title, accent = false, onOpen, action, children }: CardProps) {
  return (
    <section className={`card home-card${accent ? ' card--accent' : ''}`} aria-label={title}>
      <span className="home-card__title">{title}</span>
      {children}
      {onOpen && (
        <button type="button" className="btn btn--secondary btn--large btn--block" onClick={onOpen}>
          {action}
        </button>
      )}
    </section>
  )
}

function NoteIcon() {
  return (
    <svg aria-hidden="true" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M9 18V5l12-2v13" />
      <circle cx="6" cy="18" r="3" />
      <circle cx="18" cy="16" r="3" />
    </svg>
  )
}
