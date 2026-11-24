import { useEffect, useState } from 'react'
import {
  openQuestion,
  setAnsweredCount,
  subscribeAnswers,
  subscribeAssets,
  subscribeCorrect,
  subscribeServerTimeOffset,
} from '../data'
import { getDeviceId, getPlaybackMode, isLoggedIn, pause, replaySong, songLabel, startSong, type StartResult } from '../spotify'
import type { Answer, Choice, EventConfig, Guest, LiveState } from '../types'
import { Button } from '../ui'
import { answerStats, CHOICES, nextQuestion, positionLabel, quizPlan, secondsLeft, type PlannedQuestion } from './quiz'
import './quiz.css'

type Props = {
  eventId: string
  config: EventConfig | null
  live: LiveState | null
  guests: Record<string, Guest> | null
  disabled: boolean
  save: (write: () => Promise<void>) => Promise<boolean>
}

/**
 * Admin – musikquizet (quizdelen av docs/design/AdminKontroll.dc.html): frågan
 * som visas, svaren live, vad som kommer härnäst och låten som spelar.
 */
export function QuizPanel({ eventId, config, live, guests, disabled, save }: Props) {
  const plan = quizPlan(config)
  const currentId = live?.quiz?.qId
  const current = plan.find((p) => p.qId === currentId) ?? null
  const next = nextQuestion(plan, currentId)

  const [answers, setAnswers] = useState<Record<string, Answer>>({})
  const [correct, setCorrect] = useState<Record<string, Choice>>({})
  const [assets, setAssets] = useState<Record<string, string>>({})
  const [offset, setOffset] = useState(0)
  const [now, setNow] = useState(() => Date.now())
  const [showCorrect, setShowCorrect] = useState(false)
  const [playback, setPlayback] = useState<StartResult | null>(null)

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
    if (!currentId) {
      setAnswers({})
      return
    }
    return subscribeAnswers(eventId, currentId, setAnswers)
  }, [eventId, currentId])

  // Sekunderna kvar räknas mot serverns tid. Klockan här är bara visning.
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 250)
    return () => window.clearInterval(timer)
  }, [])

  const quiz = live?.quiz
  const left = quiz && current ? secondsLeft(quiz.openedAt, quiz.durationMs, now + offset) : null
  const stats = answerStats(answers, guests)
  const guestCount = guests ? Object.keys(guests).length : 0
  const right = current ? correct[current.qId] : undefined

  // Gästerna får inte läsa varandras svar, så admin skriver bara antalet till live/answered.
  const shown = live?.answered
  useEffect(() => {
    if (!currentId || !guests) return
    if (shown?.qId === currentId && shown.count === stats.answered && shown.total === guestCount) return
    setAnsweredCount(eventId, { qId: currentId, count: stats.answered, total: guestCount }).catch(() => {})
  }, [eventId, currentId, guests, stats.answered, guestCount, shown?.qId, shown?.count, shown?.total])

  async function openNext(target: PlannedQuestion) {
    const ok = await save(() => openQuestion(eventId, target.qId, target.durationMs))
    // Låten startas bara på första frågan till en ny låt; den spelar vidare mellan frågorna.
    if (ok && target.startsSong) setPlayback(await startSong(target.cue))
  }

  async function replay() {
    if (current) setPlayback(await replaySong(current.cue))
  }

  async function pauseSong() {
    const deviceId = getDeviceId()
    if (getPlaybackMode() !== 'spotify' || !isLoggedIn() || !deviceId) return
    try {
      await pause(deviceId)
    } catch {
      // Pausen är en bekvämlighet; quizet går vidare ändå.
    }
  }

  if (plan.length === 0) {
    return (
      <p className="muted">
        Inga quizfrågor än. Lägg till låtar och frågor under <em>Förbered kvällen</em>.
      </p>
    )
  }

  return (
    <div className="quiz-panel">
      <div className="quiz-panel__main">
        {current ? (
          <>
            <div className="quiz-panel__status">
              <span className="eyebrow eyebrow--gold">{positionLabel(current)} · visas nu</span>
              <span className="muted">
                Totalt fråga {current.overall} av {plan.length} · Svar: {stats.answered} / {guestCount} ·{' '}
                <strong className="quiz-panel__left">{left === 0 ? 'Tiden är ute' : `${left} s kvar`}</strong>
              </span>
            </div>
            <h3 className="quiz-panel__question">{current.question.text}</h3>
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
          </>
        ) : (
          <div className="quiz-panel__status">
            <span className="eyebrow eyebrow--gold">Inte startat</span>
            <span className="muted">
              {plan.length} frågor till {new Set(plan.map((p) => p.cue.songId)).size} låtar. Första låten startar med första frågan.
            </span>
          </div>
        )}

        <Playback current={current} playback={playback} onReplay={replay} onPause={pauseSong} />

        <div className="quiz-panel__actions">
          {current && (
            <Button variant="secondary" size="large" onClick={() => setShowCorrect((v) => !v)} aria-pressed={showCorrect}>
              {showCorrect ? 'Dölj rätt svar' : 'Visa rätt svar'}
            </Button>
          )}
          {next ? (
            <Button size="large" className="quiz-panel__next" disabled={disabled} onClick={() => void openNext(next)}>
              <span className="quiz-panel__next-text">
                <span>{current ? 'Nästa fråga' : 'Starta quizet'}</span>
                <span className="quiz-panel__next-sub">
                  {next.startsSong ? `Ny låt: låt ${next.cue.number} startar` : 'Samma låt fortsätter'}
                </span>
              </span>
            </Button>
          ) : (
            <p className="quiz-panel__done">Alla frågor är visade. Gå vidare till Rättning när tiden är ute.</p>
          )}
        </div>
      </div>

      <aside className="quiz-panel__side">
        <section aria-label="Härnäst">
          <span className="eyebrow">Härnäst</span>
          <ol className="quiz-next">
            {upcoming(plan, currentId).map((p) => (
              <li key={p.qId} className={`quiz-next__item${p.startsSong ? ' quiz-next__item--song' : ''}`}>
                <span className="quiz-next__tag">
                  {p.startsSong ? `Ny låt · Låt ${p.cue.number} startar` : positionLabel(p)}
                </span>
                <span className="quiz-next__text">{p.question.text}</span>
              </li>
            ))}
          </ol>
        </section>
        {current && (
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

/** De närmaste tre frågorna efter den som visas. */
function upcoming(plan: readonly PlannedQuestion[], qId: string | undefined): PlannedQuestion[] {
  const start = qId ? plan.findIndex((p) => p.qId === qId) + 1 : 0
  return plan.slice(start, start + 3)
}

type PlaybackProps = {
  current: PlannedQuestion | null
  playback: StartResult | null
  onReplay: () => void
  onPause: () => void
}

/** Vad som spelar, eller vad admin ska starta i reservläget. */
function Playback({ current, playback, onReplay, onPause }: PlaybackProps) {
  if (!current) return null
  const cue = current.cue
  const result = playback?.cue.songId === cue.songId ? playback : null
  const through = current.songCount === 1 ? '1 fråga' : `${current.songCount} frågor`
  return (
    <div className="quiz-playback" role="status">
      <div className="quiz-playback__text">
        {result?.kind === 'played' ? (
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
      <div className="admin-row">
        <Button variant="secondary" size="small" onClick={onReplay}>
          Spela låten igen
        </Button>
        {result?.kind === 'played' && (
          <Button variant="secondary" size="small" onClick={onPause}>
            Pausa
          </Button>
        )}
      </div>
    </div>
  )
}
