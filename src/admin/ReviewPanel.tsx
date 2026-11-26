import { useEffect, useState } from 'react'
import { showReview, subscribeAnswers, subscribeAssets, subscribeCorrect } from '../data'
import { formatPosition, replaySong, REVIEW_PLAYBACK, songLabel, startSong, type StartResult } from '../spotify'
import type { Answer, Choice, EventConfig, Guest, LiveState } from '../types'
import { Button } from '../ui'
import { answerStats, CHOICES, positionLabel, quizPlan, type PlannedQuestion } from './quiz'
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
 * Admin – rättning (docs/design/AdminRattning.dc.html). Admin går igenom
 * frågorna en i taget; gästerna ser rätt svar och sitt eget svar på mobilen.
 */
export function ReviewPanel({ eventId, config, live, guests, disabled, save }: Props) {
  const plan = quizPlan(config)
  const currentId = live?.wrapup?.qId
  const index = plan.findIndex((p) => p.qId === currentId)
  const current = plan[index] ?? null

  const [correct, setCorrect] = useState<Record<string, Choice>>({})
  const [answers, setAnswers] = useState<Record<string, Answer>>({})
  const [assets, setAssets] = useState<Record<string, string>>({})
  const [playback, setPlayback] = useState<StartResult | null>(null)

  useEffect(() => {
    const unsubscribers = [subscribeCorrect(eventId, setCorrect), subscribeAssets(eventId, setAssets)]
    return () => unsubscribers.forEach((unsubscribe) => unsubscribe())
  }, [eventId])

  useEffect(() => {
    if (!currentId) {
      setAnswers({})
      return
    }
    return subscribeAnswers(eventId, currentId, setAnswers)
  }, [eventId, currentId])

  async function show(target: PlannedQuestion) {
    const right = correct[target.qId]
    if (!right) return
    const ok = await save(() => showReview(eventId, target.qId, right))
    // En ny låt i rättningen börjar spela av sig själv, 30 sekunder in med en kort fade-in.
    // Nästa fråga på samma låt rör inte uppspelningen.
    if (ok && target.cue.songId !== current?.cue.songId) setPlayback(await startSong(target.cue, REVIEW_PLAYBACK))
  }

  async function replay() {
    if (current) setPlayback(await replaySong(current.cue, REVIEW_PLAYBACK))
  }

  if (plan.length === 0) return <p className="muted">Inga quizfrågor att gå igenom.</p>

  const stats = answerStats(answers, guests)
  const guestCount = guests ? Object.keys(guests).length : 0
  const right = current ? correct[current.qId] : undefined
  const prev = index > 0 ? plan[index - 1] : null
  const next = index < 0 ? plan[0] : (plan[index + 1] ?? null)
  const songs = groupBySong(plan)

  return (
    <div className="quiz-panel review-panel">
      <nav className="review-nav" aria-label="Alla frågor">
        <span className="eyebrow">Alla frågor</span>
        {songs.map(({ cue, questions }) => (
          <div key={cue.songId} className="review-nav__song">
            <span className="review-nav__name">{songLabel(cue)}</span>
            <div className="review-nav__questions">
              {questions.map((p) => {
                const missing = !correct[p.qId]
                return (
                  <button
                    key={p.qId}
                    type="button"
                    className="review-nav__question"
                    aria-current={p.qId === currentId ? 'true' : undefined}
                    aria-label={`Fråga ${p.overall}${missing ? ', saknar rätt svar' : ''}`}
                    disabled={disabled || missing}
                    onClick={() => void show(p)}
                  >
                    {p.overall}
                  </button>
                )
              })}
            </div>
          </div>
        ))}
      </nav>

      <div className="quiz-panel__main">
        {current ? (
          <>
            <div className="quiz-panel__status">
              <span className="eyebrow eyebrow--gold">
                {positionLabel(current)} · totalt {current.overall} av {plan.length}
              </span>
              <strong>
                {right ? stats.counts[right] : 0} av {guestCount} hade rätt
              </strong>
            </div>
            <h3 className="quiz-panel__question">{current.question.text}</h3>
            <ul className="review-answers" aria-label="Svarsfördelning">
              {CHOICES.map((choice) => {
                const isRight = right === choice
                const option = current.question.options[choice]
                const count = stats.counts[choice]
                return (
                  <li key={choice} className={`review-answer${isRight ? ' review-answer--right' : ''}`}>
                    <span className="review-answer__letter">{choice}</span>
                    {current.question.answerType === 'image' ? (
                      assets[option] ? (
                        <img className="review-answer__image" src={assets[option]} alt={`Svar ${choice}`} />
                      ) : (
                        <span className="review-answer__text muted">Bild {choice}</span>
                      )
                    ) : (
                      <span className="review-answer__text">{option}</span>
                    )}
                    <span className="review-answer__bar" aria-hidden="true">
                      <span style={{ width: `${guestCount ? (count / guestCount) * 100 : 0}%` }} />
                    </span>
                    <span className="review-answer__count">
                      {count} svar{isRight ? ' · rätt' : ''}
                    </span>
                  </li>
                )
              })}
            </ul>
            <div className="quiz-playback">
              <div className="quiz-playback__text">
                <strong>Spela låten igen · {songLabel(current.cue)}</strong>
                <span className="muted">
                  {playback?.cue.songId === current.cue.songId && playback.kind === 'manual'
                    ? playback.instruction
                    : `Spelar från ${formatPosition(REVIEW_PLAYBACK.positionMs)}`}
                </span>
              </div>
              <Button variant="secondary" size="small" onClick={() => void replay()}>
                Spela låten igen
              </Button>
            </div>
          </>
        ) : (
          <div className="quiz-panel__status">
            <span className="eyebrow eyebrow--gold">Rättningen har inte börjat</span>
            <span className="muted">Gästerna ser rätt svar och sitt eget svar på mobilen när du visar en fråga.</span>
          </div>
        )}

        <div className="quiz-panel__actions">
          {prev && (
            <Button variant="secondary" size="large" disabled={disabled} onClick={() => void show(prev)}>
              Föregående
            </Button>
          )}
          {next ? (
            <Button size="large" className="quiz-panel__next" disabled={disabled || !correct[next.qId]} onClick={() => void show(next)}>
              <span className="quiz-panel__next-text">
                <span>{current ? 'Nästa fråga' : 'Börja med fråga 1'}</span>
                <span className="quiz-panel__next-sub">
                  {next.startsSong ? `Ny låt: ${songLabel(next.cue)}` : 'Samma låt'}
                </span>
              </span>
            </Button>
          ) : (
            <p className="quiz-panel__done">Sista frågan är rättad. Gå vidare till Gissa glöggen och sedan topplistan.</p>
          )}
        </div>
      </div>
    </div>
  )
}

function groupBySong(plan: readonly PlannedQuestion[]) {
  const groups: { cue: PlannedQuestion['cue']; questions: PlannedQuestion[] }[] = []
  for (const p of plan) {
    const last = groups[groups.length - 1]
    if (last && last.cue.songId === p.cue.songId) last.questions.push(p)
    else groups.push({ cue: p.cue, questions: [p] })
  }
  return groups
}
