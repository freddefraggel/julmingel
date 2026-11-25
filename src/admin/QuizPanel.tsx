import { useEffect, useRef, useState } from 'react'
import {
  closeQuestion,
  openQuestion,
  playSong,
  setAnsweredCount,
  setQuizIdle,
  subscribeAnswers,
  subscribeAssets,
  subscribeCorrect,
  subscribeServerTimeOffset,
} from '../data'
import { quizTiming } from '../live'
import { getDeviceId, getPlaybackMode, isLoggedIn, pause, replaySong, songLabel, startSong, type StartResult } from '../spotify'
import type { Answer, Choice, EventConfig, Guest, LiveState } from '../types'
import { Button } from '../ui'
import {
  answerStats,
  CHOICES,
  nextSong,
  positionLabel,
  quizControl,
  quizPlan,
  secondsLeft,
  type PlannedQuestion,
} from './quiz'
import './quiz.css'

type Props = {
  eventId: string
  config: EventConfig | null
  live: LiveState | null
  guests: Record<string, Guest> | null
  disabled: boolean
  save: (write: () => Promise<void>) => Promise<boolean>
}

/** Vad gästerna ser i varje läge, så att admin vet vad som händer på mobilerna. */
const GUESTS_SEE: Record<string, string> = {
  idle: 'Gästerna ser provningen – ingen fråga',
  playing: 'Gästerna ser ”Lyssna noga …” – ingen timer',
  open: 'Gästerna ser frågan – de kan byta svar tills tiden är ute',
  closed: 'Gästerna är tillbaka i provningen',
}

/**
 * Admin – musikquizet (quizkolumnen i docs/design/AdminKontroll.dc.html), i två
 * steg: *Spela låt* startar låten utan fråga och tid, *Visa fråga* startar tiden.
 */
export function QuizPanel({ eventId, config, live, guests, disabled, save }: Props) {
  const plan = quizPlan(config)
  const quiz = live?.quiz
  const state = quiz?.state ?? 'idle'
  // Svar finns bara för en fråga som har visats.
  const shownId = state === 'open' || state === 'closed' ? quiz?.qId : undefined

  const [answers, setAnswers] = useState<Record<string, Answer>>({})
  const [correct, setCorrect] = useState<Record<string, Choice>>({})
  const [assets, setAssets] = useState<Record<string, string>>({})
  const [offset, setOffset] = useState(0)
  const [now, setNow] = useState(() => Date.now())
  const [showCorrect, setShowCorrect] = useState(false)
  const [playback, setPlayback] = useState<StartResult | null>(null)
  const closing = useRef<string | null>(null)

  useEffect(() => {
    const unsubscribers = [
      subscribeCorrect(eventId, setCorrect),
      subscribeAssets(eventId, setAssets),
      subscribeServerTimeOffset(setOffset),
    ]
    return () => unsubscribers.forEach((unsubscribe) => unsubscribe())
  }, [eventId])

  useEffect(() => {
    setShowCorrect(false)
    if (!shownId) {
      setAnswers({})
      return
    }
    return subscribeAnswers(eventId, shownId, setAnswers)
  }, [eventId, shownId])

  // Sekunderna kvar räknas mot serverns tid. Klockan här är bara visning.
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 250)
    return () => window.clearInterval(timer)
  }, [])

  const timing = quizTiming(live)
  const left = state === 'open' && timing ? secondsLeft(timing.openedAt, timing.durationMs, now + offset) : null
  const control = quizControl(plan, quiz, left)
  const current = control.current
  const stats = answerStats(answers, guests)
  const guestCount = guests ? Object.keys(guests).length : 0
  const right = current ? correct[current.qId] : undefined

  // Tiden är ute: admin-enheten stänger frågan, en gång per visning.
  useEffect(() => {
    if (state !== 'open' || left !== 0 || !quiz?.qId || !timing) return
    const key = `${quiz.qId}:${timing.openedAt}`
    if (closing.current === key) return
    closing.current = key
    closeQuestion(eventId).catch(() => {
      closing.current = null
    })
  }, [eventId, state, left, quiz?.qId, timing])

  // Gästerna får inte läsa varandras svar, så admin skriver bara antalet till live/answered.
  const shown = live?.answered
  useEffect(() => {
    if (!shownId || !guests) return
    if (shown?.qId === shownId && shown.count === stats.answered && shown.total === guestCount) return
    setAnsweredCount(eventId, { qId: shownId, count: stats.answered, total: guestCount }).catch(() => {})
  }, [eventId, shownId, guests, stats.answered, guestCount, shown?.qId, shown?.count, shown?.total])

  async function onPrimary() {
    const action = control.primary
    if (action.kind === 'play') {
      const target = action.target
      const ok = await save(() => playSong(eventId, target.cue.songId, target.qId))
      if (ok) setPlayback(await startSong(target.cue))
    } else if (action.kind === 'open') {
      const target = action.target
      await save(() => openQuestion(eventId, target.qId, target.cue.songId, target.durationMs))
    }
  }

  async function onSide() {
    const side = control.side
    if (!side || !current) return
    if (side.kind === 'close') {
      await save(() => closeQuestion(eventId))
    } else if (side.kind === 'skip') {
      const following = nextSong(plan, current)
      if (following) await save(() => setQuizIdle(eventId, following.qId))
    } else {
      // Pausa: låten stannar, och quizet fortsätter med samma låt när admin trycker på Spela låt igen.
      const resume = control.primary.kind === 'wait' ? current : control.primary.target
      await pauseSpotify()
      await save(() => setQuizIdle(eventId, resume.qId))
    }
  }

  async function replay() {
    if (current) setPlayback(await replaySong(current.cue))
  }

  if (plan.length === 0) {
    return (
      <p className="muted">
        Inga quizfrågor än. Lägg till låtar och frågor under <em>Förbered kvällen</em>.
      </p>
    )
  }

  const shownQuestion = shownId !== undefined && current?.qId === shownId
  const label = !current
    ? 'Klart'
    : state === 'open'
      ? `${positionLabel(current)} · öppen`
      : state === 'closed'
        ? `${positionLabel(current)} · stängd`
        : `${positionLabel(current)} · nästa att visa`

  return (
    <div className="quiz-panel">
      <div className="quiz-panel__main">
        {current && (
          <>
            <div className="quiz-panel__status">
              <span className="eyebrow eyebrow--gold">{label}</span>
              <span className="muted">
                Totalt fråga {current.overall} av {plan.length}
                {shownQuestion && ` · Svar: ${stats.answered} / ${guestCount}`}
                {left !== null && (
                  <>
                    {' · '}
                    <strong className="quiz-panel__left">{left === 0 ? 'Tiden är ute' : `${left} s kvar`}</strong>
                  </>
                )}
              </span>
            </div>
            <h3 className="quiz-panel__question">{current.question.text}</h3>
            {shownQuestion ? (
              <ul className="quiz-answers" aria-label="Svar">
                {CHOICES.map((choice) => {
                  const isRight = showCorrect && right === choice
                  const option = current.question.options[choice]
                  return (
                    <li key={choice} className={`quiz-answer${isRight ? ' quiz-answer--right' : ''}`}>
                      <span className="quiz-answer__meta">
                        {choice}
                        {isRight ? ' · rätt' : ''} · {stats.counts[choice]} svar
                      </span>
                      {current.question.answerType === 'image' ? (
                        assets[option] ? (
                          <img className="quiz-answer__image" src={assets[option]} alt={`Svar ${choice}`} />
                        ) : (
                          <span className="muted">Bild saknas</span>
                        )
                      ) : (
                        <span className="quiz-answer__text">{option}</span>
                      )}
                    </li>
                  )
                })}
              </ul>
            ) : (
              <p className="muted">
                {state === 'playing' ? 'Visas när du trycker – tiden börjar då.' : 'Frågan visas efter att låten har startat.'}
              </p>
            )}
          </>
        )}

        <Playback current={current} state={state} playback={playback} onReplay={replay} />
        <p className="quiz-panel__guests" role="status">
          {GUESTS_SEE[state] ?? ''}
        </p>

        <div className="quiz-panel__actions">
          {shownQuestion && (
            <Button variant="secondary" size="large" onClick={() => setShowCorrect((v) => !v)} aria-pressed={showCorrect}>
              {showCorrect ? 'Dölj rätt svar' : 'Visa rätt svar'}
            </Button>
          )}
          <Button
            size="large"
            className={`quiz-panel__next${control.primary.kind === 'wait' ? ' quiz-panel__next--wait' : ''}`}
            disabled={disabled || control.primary.kind === 'wait'}
            onClick={() => void onPrimary()}
          >
            {control.primary.label}
          </Button>
        </div>
        <div className="quiz-panel__secondary">
          <span className="muted">{control.later}</span>
          {control.side && (
            <Button variant="secondary" size="small" disabled={disabled} onClick={() => void onSide()}>
              {control.side.label}
            </Button>
          )}
        </div>
      </div>

      <aside className="quiz-panel__side">
        <section aria-label="Härnäst">
          <span className="eyebrow">Härnäst</span>
          <ol className="quiz-next">
            {upcoming(plan, current).map((p) => (
              <li key={p.qId} className={`quiz-next__item${p.startsSong ? ' quiz-next__item--song' : ''}`}>
                <span className="quiz-next__tag">
                  {p.startsSong ? `Ny låt · Låt ${p.cue.number} startar` : positionLabel(p)}
                </span>
                <span className="quiz-next__text">{p.question.text}</span>
              </li>
            ))}
          </ol>
        </section>
        {shownQuestion && (
          <section aria-label="Väntar på svar">
            <span className="eyebrow">Väntar på svar</span>
            {stats.waiting.length === 0 ? (
              <p className="muted">Alla har svarat.</p>
            ) : (
              <ul className="quiz-waiting">
                {stats.waiting.map((name, i) => (
                  <li key={`${name}-${i}`} className="chip">
                    {name}
                  </li>
                ))}
              </ul>
            )}
          </section>
        )}
      </aside>
    </div>
  )
}

/** Pausar Spotify om appen styr uppspelningen. Kastar aldrig: quizet går vidare ändå. */
async function pauseSpotify() {
  const deviceId = getDeviceId()
  if (getPlaybackMode() !== 'spotify' || !isLoggedIn() || !deviceId) return
  try {
    await pause(deviceId)
  } catch {
    // Pausen är en bekvämlighet.
  }
}

/** De närmaste tre frågorna efter den som visas eller ska visas. */
function upcoming(plan: readonly PlannedQuestion[], current: PlannedQuestion | null): PlannedQuestion[] {
  const start = current ? current.overall : 0
  return plan.slice(start, start + 3)
}

type PlaybackProps = {
  current: PlannedQuestion | null
  state: string
  playback: StartResult | null
  onReplay: () => void
}

/** Vad som spelar, eller vad admin ska starta i reservläget. */
function Playback({ current, state, playback, onReplay }: PlaybackProps) {
  if (!current) return null
  const cue = current.cue
  const result = playback?.cue.songId === cue.songId ? playback : null
  const through = current.songCount === 1 ? '1 fråga' : `${current.songCount} frågor`
  const started = state !== 'idle'
  return (
    <div className="quiz-playback">
      <div className="quiz-playback__text">
        {!started ? (
          <strong>
            Låt {cue.number} · {songLabel(cue)} <span className="muted">· inte startad</span>
          </strong>
        ) : result?.kind === 'played' ? (
          <strong>
            Spelar på Spotify · {songLabel(cue)} <span className="muted">· spelar vidare genom {through}</span>
          </strong>
        ) : result?.kind === 'manual' ? (
          <>
            <strong>{result.instruction}</strong>
            {result.reason && <span className="muted">Spotify: {result.reason}</span>}
          </>
        ) : (
          <strong>
            {songLabel(cue)} <span className="muted">· spelar vidare genom {through}</span>
          </strong>
        )}
      </div>
      {started && (
        <Button variant="secondary" size="small" onClick={onReplay}>
          Spela låten igen
        </Button>
      )}
    </div>
  )
}
