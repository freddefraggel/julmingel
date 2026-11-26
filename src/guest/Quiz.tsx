import { useEffect, useState, type ReactNode } from 'react'
import { sendAnswer, subscribeOwnAnswer, subscribeServerTimeOffset } from '../data'
import { starsFor } from '../scoring'
import { quizTiming } from '../live'
import type { Answer, Choice, EventConfig, LiveState, QuestionTiming } from '../types'
import { CupTimer, Garland, Stars } from '../ui'
import { useAsset } from './assets'

const CHOICES: readonly Choice[] = ['A', 'B', 'C', 'D']

type Props = {
  eventId: string
  uid: string
  config: EventConfig | null
  live: LiveState
  /** *Till provningen*: gästen lämnar quizvyn tills nästa fråga visas. */
  onLeave?: () => void
}

/** Var frågan ligger: ”Låt 2 · fråga 1 av 3”, och om nästa fråga gäller samma låt. */
export function questionPosition(config: EventConfig | null, qId: string) {
  const question = config?.questions?.[qId]
  if (!question) return null
  const songs = Object.entries(config?.songs ?? {}).sort(([a, x], [b, y]) => x.order - y.order || a.localeCompare(b))
  const songNumber = songs.findIndex(([id]) => id === question.songId) + 1
  const inSong = Object.entries(config?.questions ?? {})
    .filter(([, q]) => q.songId === question.songId)
    .sort(([a, x], [b, y]) => x.order - y.order || (a < b ? -1 : 1))
    .map(([id]) => id)
  const index = inSong.indexOf(qId)
  return {
    question,
    label: `Låt ${songNumber > 0 ? songNumber : '?'} · fråga ${index + 1} av ${inSong.length}`,
    songNumber,
    songCount: inSong.length,
    sameSongNext: index < inSong.length - 1,
  }
}

/**
 * 5. Quizfråga och 6. Tiden är ute. Nedräkningen går mot `openedAt + durationMs`
 * i serverns tid (`.info/serverTimeOffset`), så att mobilens klocka eller en
 * omladdning inte ändrar sluttiden.
 */
export function Quiz({ eventId, uid, config, live, onLeave }: Props) {
  const quiz = live.quiz
  const [offset, setOffset] = useState(0)
  const [now, setNow] = useState(() => Date.now())
  const [answer, setAnswer] = useState<Answer | null>(null)
  const [pending, setPending] = useState<Choice | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => subscribeServerTimeOffset(setOffset), [])

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 250)
    return () => window.clearInterval(timer)
  }, [])

  const qId = quiz?.qId
  useEffect(() => {
    setAnswer(null)
    setPending(null)
    setError(null)
    if (!qId) return
    return subscribeOwnAnswer(eventId, qId, uid, setAnswer)
  }, [eventId, qId, uid])

  const timing = quizTiming(live)
  const currentQId = quiz?.qId

  if (!quiz || !currentQId || quiz.state === 'idle') {
    return (
      <QuizPage label="">
        <div className="quiz-wait">
          <h1>Musikquizet börjar snart</h1>
          <p className="muted">Frågorna dyker upp här när quizledaren startar. Lyssna efter låten!</p>
        </div>
      </QuizPage>
    )
  }

  // 5a. Spela låt: låten går, men frågan och tiden kommer först med Visa fråga.
  if (quiz.state === 'playing' || !timing) {
    const song = questionPosition(config, currentQId)
    return (
      <QuizPage label={song ? `Musikquiz · låt ${song.songNumber}` : ''} onLeave={onLeave} title={false}>
        <div className="quiz-listen">
          <span className="quiz-listen__eq" aria-hidden="true">
            <span />
            <span />
            <span />
            <span />
            <span />
            <span />
          </span>
          <h1>Lyssna noga …</h1>
          <p className="quiz-listen__text">Frågan kommer strax.</p>
        </div>
        {song && (
          <p className="quiz-listen__count">
            {song.songCount === 1 ? '1 fråga om den här låten' : `${song.songCount} frågor om den här låten`}
          </p>
        )}
      </QuizPage>
    )
  }

  const position = questionPosition(config, currentQId)
  const serverNow = now + offset
  const msLeft = timing.openedAt + timing.durationMs - serverNow
  const open = quiz.state === 'open' && msLeft > 0
  const chosen = pending ?? answer?.choice ?? null

  async function choose(choice: Choice) {
    if (!currentQId || !open) return
    setPending(choice)
    setError(null)
    try {
      await sendAnswer(eventId, currentQId, uid, choice)
    } catch {
      setError('Svaret kom inte fram. Tiden kan vara ute.')
    }
    setPending(null)
  }

  if (!position) {
    return (
      <QuizPage label="">
        <div className="quiz-wait">
          <h1>Ett ögonblick…</h1>
          <p className="muted">Frågan laddas.</p>
        </div>
      </QuizPage>
    )
  }

  if (!open) {
    return (
      <TimeUp
        label={position.label}
        config={config}
        live={live}
        qId={currentQId}
        timing={timing}
        answer={answer}
        sameSongNext={position.sameSongNext}
        onLeave={onLeave}
      />
    )
  }

  const { question } = position
  const potential = starsFor(serverNow, timing)

  return (
    <QuizPage label={position.label} onLeave={onLeave}>
      <div className="quiz-bar">
        <span className="quiz-bar__eq" aria-hidden="true">
          <span />
          <span />
          <span />
          <span />
          <span />
        </span>
        <span className="quiz-bar__text">Låten spelas nu</span>
        <CupTimer secondsLeft={msLeft / 1000} totalSeconds={timing.durationMs / 1000} />
      </div>
      <div className="quiz-stars">
        <span className="muted">{chosen ? 'Byt svar om du vill – det senaste gäller' : 'Svara snabbt för fler stjärnor'}</span>
        <Stars count={potential} label={`${potential} av 3 snabbhetsstjärnor kvar`} />
      </div>
      <h1 className="quiz-question">{question.text}</h1>
      <div className={`quiz-options${question.answerType === 'image' ? ' quiz-options--image' : ''}`}>
        {CHOICES.map((choice) => (
          <Option
            key={choice}
            choice={choice}
            value={question.options[choice]}
            image={question.answerType === 'image'}
            pressed={chosen === choice}
            onPick={() => void choose(choice)}
          />
        ))}
      </div>
      <div className="quiz__spacer" />
      {error ? (
        <p role="alert" className="form-error">
          {error}
        </p>
      ) : (
        <p className="quiz-foot" role="status">
          {answer ? `Svar skickat: ${answer.choice}. Du kan byta tills tiden är ute.` : 'Tryck på ett svar. Du kan byta tills tiden är ute.'}
        </p>
      )}
    </QuizPage>
  )
}

type QuizPageProps = {
  label: string
  children: ReactNode
  /** Länken *Till provningen* uppe till vänster. */
  onLeave?: () => void
  /** Rubriken *Musikquiz*; 5a visar i stället bara låten till höger. */
  title?: boolean
}

function QuizPage({ label, children, onLeave, title = true }: QuizPageProps) {
  return (
    <main className="page guest-page quiz">
      <Garland />
      <div className="quiz__head">
        {onLeave ? (
          <button type="button" className="guest-back" onClick={onLeave}>
            <svg aria-hidden="true" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M15 6l-6 6 6 6" />
            </svg>
            Till provningen
          </button>
        ) : (
          title && <span className="eyebrow eyebrow--gold">Musikquiz</span>
        )}
        {label && <span className="quiz__position">{label}</span>}
      </div>
      {children}
    </main>
  )
}

type OptionProps = { choice: Choice; value: string; image: boolean; pressed: boolean; onPick: () => void }

function Option({ choice, value, image, pressed, onPick }: OptionProps) {
  const src = useAsset(image ? value : undefined)
  return (
    <button
      type="button"
      className={`quiz-option${pressed ? ' quiz-option--pressed' : ''}`}
      aria-pressed={pressed}
      aria-label={image ? `Svar ${choice}` : `${choice}: ${value}`}
      onClick={onPick}
    >
      <span className="quiz-option__letter">{choice}</span>
      {image ? (
        <span className="quiz-option__image">{src ? <img src={src} alt="" /> : <span className="muted">Bild {choice}</span>}</span>
      ) : (
        <span className="quiz-option__text">{value}</span>
      )}
    </button>
  )
}

type TimeUpProps = {
  label: string
  config: EventConfig | null
  live: LiveState
  qId: string
  timing: QuestionTiming
  answer: Answer | null
  sameSongNext: boolean
  onLeave?: () => void
}

/** 6. Tiden är ute: låst svar, möjliga stjärnor och hur många som har svarat. */
function TimeUp({ label, config, live, qId, timing, answer, sameSongNext, onLeave }: TimeUpProps) {
  const question = config?.questions?.[qId]
  const stars = answer ? starsFor(answer.at, timing) : 0
  const answered = live.answered?.qId === qId ? live.answered : null
  const text = answer && question && question.answerType === 'text' ? `${answer.choice} · ${question.options[answer.choice]}` : answer?.choice

  return (
    <QuizPage label={label} onLeave={onLeave}>
      <div className="quiz-done">
        <div className="quiz-done__icon" aria-hidden="true">
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="13" r="8" />
            <path d="M12 9v4l2.5 2.5M9 2h6" />
          </svg>
        </div>
        <h1>Tiden är ute!</h1>
        {answer ? (
          <>
            <div className="quiz-done__answer">
              <span className="muted">Ditt låsta svar</span>
              <strong>{text}</strong>
            </div>
            <div className="quiz-done__stars">
              <Stars count={stars} label={`${stars} av 3 snabbhetsstjärnor`} />
              <span className="muted">{stars > 0 ? `Snabbt! +${stars} ${stars === 1 ? 'stjärna' : 'stjärnor'} om svaret är rätt` : 'Inga snabbhetsstjärnor den här gången'}</span>
            </div>
          </>
        ) : (
          <p className="muted">Du hann inte svara på den här frågan.</p>
        )}
        <p className="quiz-done__next">
          {sameSongNext ? 'Lyssna vidare – nästa fråga handlar om samma låt.' : 'Nästa fråga kommer med en ny låt.'}
          <br />
          Tryck på Till provningen när du vill.
        </p>
      </div>
      {answered && (
        <div className="quiz-done__count">
          <div className="quiz-done__count-row">
            <span className="muted">Har svarat</span>
            <strong>
              {answered.count} av {answered.total}
            </strong>
          </div>
          <div className="home-card__bar" aria-hidden="true">
            <div style={{ width: `${answered.total ? Math.min(100, (answered.count / answered.total) * 100) : 0}%` }} />
          </div>
        </div>
      )}
    </QuizPage>
  )
}
