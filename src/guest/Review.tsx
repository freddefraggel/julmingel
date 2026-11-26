import { useEffect, useState } from 'react'
import { subscribeOwnAnswer, subscribeReveal } from '../data'
import type { Answer, Choice, EventConfig, EventReveal, LiveState } from '../types'
import { Garland } from '../ui'
import { useAsset } from './assets'
import { questionPosition } from './Quiz'

const CHOICES: readonly Choice[] = ['A', 'B', 'C', 'D']

type Props = {
  eventId: string
  uid: string
  config: EventConfig | null
  live: LiveState
}

/** Gästens egna svar på frågorna, qId → svar. Gästen får bara läsa sina egna. */
function useOwnAnswers(eventId: string, uid: string, qIds: readonly string[]): Record<string, Answer | null> {
  const [answers, setAnswers] = useState<Record<string, Answer | null>>({})
  const key = [...qIds].sort().join(',')
  useEffect(() => {
    const ids = key ? key.split(',') : []
    const unsubscribers = ids.map((qId) =>
      subscribeOwnAnswer(eventId, qId, uid, (answer) => setAnswers((a) => ({ ...a, [qId]: answer }))),
    )
    return () => unsubscribers.forEach((unsubscribe) => unsubscribe())
  }, [eventId, uid, key])
  return answers
}

/**
 * Låten som frågan gäller: ”Last Christmas – Wham!”. Visas bara i rättningen,
 * så att inget avslöjas under quizet. Saknas titel blir det ”Låt N”.
 */
export function songTitle(config: EventConfig | null, songId: string, songNumber: number): string {
  const song = config?.songs?.[songId]
  const title = song?.title?.trim()
  if (!title) return `Låt ${songNumber > 0 ? songNumber : '?'}`
  const artist = song?.artist?.trim()
  return artist ? `${title} – ${artist}` : title
}

/** Poäng hittills: 1 per rätt svar bland frågorna som har rättats. */
export function pointsSoFar(correct: Record<string, Choice> | undefined, answers: Record<string, Answer | null>): number {
  return Object.entries(correct ?? {}).filter(([qId, right]) => answers[qId]?.choice === right).length
}

/** 7a. Rättning: rätt svar, gästens eget svar och poängen hittills. */
export function Review({ eventId, uid, config, live }: Props) {
  const [reveal, setReveal] = useState<EventReveal>({})
  useEffect(() => subscribeReveal(eventId, setReveal), [eventId])

  const qId = live.wrapup?.qId
  const answers = useOwnAnswers(eventId, uid, Object.keys(reveal.correct ?? {}))
  const position = qId ? questionPosition(config, qId) : null
  const right = qId ? reveal.correct?.[qId] : undefined
  const points = pointsSoFar(reveal.correct, answers)

  return (
    <main className="page guest-page review">
      <Garland />
      <div className="quiz__head">
        <span className="eyebrow eyebrow--gold">Rättning</span>
        {position && <span className="quiz__position">{position.label}</span>}
      </div>

      {!position || !right || !qId ? (
        <div className="quiz-wait">
          <h1>Rättningen börjar snart</h1>
          <p className="muted">Quizledaren går igenom frågorna en i taget. Rätt svar visas här.</p>
        </div>
      ) : (
        <>
          <div className="review__song">
            <span className="quiz-bar__eq" aria-hidden="true">
              <span />
              <span />
              <span />
            </span>
            <strong className="review__song-title">{songTitle(config, position.question.songId, position.songNumber)}</strong>
          </div>
          <h1 className="quiz-question">{position.question.text}</h1>
          <ul className="review-options" aria-label="Svar">
            {CHOICES.map((choice) => (
              <ReviewOption
                key={choice}
                choice={choice}
                value={position.question.options[choice]}
                image={position.question.answerType === 'image'}
                right={choice === right}
                mine={answers[qId]?.choice === choice}
              />
            ))}
          </ul>
          <Verdict answer={answers[qId]} right={right} />
        </>
      )}

      <div className="quiz__spacer" />
      <div className="review__points">
        <span className="muted">Dina poäng hittills</span>
        <strong>{points} p</strong>
      </div>
    </main>
  )
}

type OptionProps = { choice: Choice; value: string; image: boolean; right: boolean; mine: boolean }

function ReviewOption({ choice, value, image, right, mine }: OptionProps) {
  const src = useAsset(image ? value : undefined)
  const classes = ['review-option']
  if (right) classes.push('review-option--right')
  else if (mine) classes.push('review-option--mine')
  const tag = right && mine ? 'Rätt · ditt svar' : right ? 'Rätt svar' : mine ? 'Ditt svar' : null
  return (
    <li className={classes.join(' ')}>
      <span className="review-option__letter">{choice}</span>
      {image ? (
        src ? (
          <img className="review-option__image" src={src} alt={`Svar ${choice}`} />
        ) : (
          <span className="review-option__text muted">Bild {choice}</span>
        )
      ) : (
        <span className="review-option__text">{value}</span>
      )}
      {tag && <span className="review-option__tag">{tag}</span>}
    </li>
  )
}

function Verdict({ answer, right }: { answer: Answer | null | undefined; right: Choice }) {
  if (answer === undefined) return null
  const text = !answer ? 'Du svarade inte på den här.' : answer.choice === right ? 'Rätt! +1 poäng.' : 'Nära! Ingen poäng på den här.'
  return (
    <p className={`review__verdict${answer?.choice === right ? ' review__verdict--right' : ''}`} role="status">
      {text}
    </p>
  )
}
