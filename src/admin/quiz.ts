// Musikquizet hos admin: frågornas ordning, vad som kommer härnäst och svaren.
// Rena funktioner utan Firebase, så att de kan testas.
import { songCues, type SongCue } from '../spotify'
import type { Answer, Choice, EventConfig, Guest, Question } from '../types'

export const CHOICES: readonly Choice[] = ['A', 'B', 'C', 'D']

/** En fråga på sin plats i quizet. */
export type PlannedQuestion = {
  qId: string
  question: Question
  cue: SongCue
  /** 1-baserat inom låten och i hela quizet. */
  inSong: number
  songCount: number
  overall: number
  /** Första frågan på låten: då startas låten. */
  startsSong: boolean
  durationMs: number
}

/**
 * Alla frågor i spelordning: låtarna i `order`, frågorna i `order` inom låten.
 * Frågor till en låt som inte finns hoppas över.
 */
export function quizPlan(config: EventConfig | null | undefined): PlannedQuestion[] {
  const cues = songCues(config?.songs)
  const questions = Object.entries(config?.questions ?? {}).sort(
    ([a, x], [b, y]) => x.order - y.order || (a < b ? -1 : 1),
  )
  const plan: PlannedQuestion[] = []
  for (const cue of cues) {
    const song = config!.songs![cue.songId]!
    const own = questions.filter(([, q]) => q.songId === cue.songId)
    own.forEach(([qId, question], i) => {
      plan.push({
        qId,
        question,
        cue,
        inSong: i + 1,
        songCount: own.length,
        overall: plan.length + 1,
        startsSong: i === 0,
        durationMs: Math.max(1, song.secondsPerQuestion) * 1000,
      })
    })
  }
  return plan
}

/** ”Låt 2 · fråga 1 av 3” */
export function positionLabel(p: PlannedQuestion): string {
  return `Låt ${p.cue.number} · fråga ${p.inSong} av ${p.songCount}`
}

export type AnswerStats = {
  counts: Record<Choice, number>
  answered: number
  /** Namnen på gästerna som inte har svarat, i bokstavsordning. */
  waiting: string[]
}

/** Fördelningen av svaren och vilka som inte har svarat. Bara gäster som finns räknas. */
export function answerStats(answers: Record<string, Answer> | null | undefined, guests: Record<string, Guest> | null | undefined): AnswerStats {
  const counts: Record<Choice, number> = { A: 0, B: 0, C: 0, D: 0 }
  let answered = 0
  const waiting: string[] = []
  for (const [uid, guest] of Object.entries(guests ?? {})) {
    const choice = answers?.[uid]?.choice
    if (choice && choice in counts) {
      counts[choice] += 1
      answered += 1
    } else {
      waiting.push(guest.name)
    }
  }
  waiting.sort(new Intl.Collator('sv').compare)
  return { counts, answered, waiting }
}

/** Hela sekunder kvar till `openedAt + durationMs` i serverns tid, aldrig under 0. */
export function secondsLeft(openedAt: number, durationMs: number, serverNow: number): number {
  return Math.max(0, Math.ceil((openedAt + durationMs - serverNow) / 1000))
}

/** Vad huvudknappen gör: starta en låt, visa en fråga, eller inget (frågan är öppen eller quizet är klart). */
export type QuizAction =
  | { kind: 'play'; target: PlannedQuestion; label: string }
  | { kind: 'open'; target: PlannedQuestion; label: string }
  | { kind: 'wait'; label: string }

/** Sidoknappen: pausa eller hoppa över låten, eller stänga en öppen fråga. */
export type QuizSide = { kind: 'pause' | 'skip' | 'close'; label: string } | null

export type QuizControl = {
  /** Frågan som admin ser just nu: den som visas, eller nästa att visa. */
  current: PlannedQuestion | null
  primary: QuizAction
  side: QuizSide
  /** ”Sedan: fråga 5 – Vem sjunger?” */
  later: string
}

/** Första frågan på låten efter `p`, eller null om det var sista låten. */
export function nextSong(plan: readonly PlannedQuestion[], p: PlannedQuestion): PlannedQuestion | null {
  return plan.find((q) => q.overall > p.overall && q.startsSong) ?? null
}

const playAction = (target: PlannedQuestion): QuizAction => ({ kind: 'play', target, label: `Spela låt ${target.cue.number}` })

/**
 * Huvudknappen i quizet, efter läget i `live/quiz`:
 * - `idle` → *Spela låt N* (låten startar, ingen fråga, ingen tid)
 * - `playing` → *Visa fråga N* (tiden startar)
 * - `open` → avstängd *Fråga N är öppen · 18 s kvar*, med *Stäng frågan nu* bredvid
 * - `closed` → *Visa fråga N+1 · samma låt*, *Spela låt M* eller klart
 *
 * I läget `idle` pekar `qId` på frågan som quizet fortsätter med; saknas den börjar quizet från början.
 */
export function quizControl(
  plan: readonly PlannedQuestion[],
  quiz: { state: string; qId?: string } | null | undefined,
  secondsLeft: number | null,
): QuizControl {
  const find = (qId: string | undefined) => plan.find((p) => p.qId === qId) ?? null
  const state = quiz?.state ?? 'idle'
  const at = find(quiz?.qId)
  const done: QuizAction = { kind: 'wait', label: 'Alla frågor klara – starta rättningen när ni vill' }
  // overall är 1-baserat, så plan[p.overall] är frågan efter p.
  const after = (p: PlannedQuestion | null) => (p ? (plan[p.overall] ?? null) : null)

  const laterFrom = (p: PlannedQuestion | null): string => {
    const next = after(p)
    if (!next) return 'Sista frågan'
    if (!next.startsSong) return `Sedan: fråga ${next.overall} – ${next.question.text}`
    const count = plan.filter((q) => q.cue.songId === next.cue.songId).length
    return `Sedan: låt ${next.cue.number} (${count === 1 ? '1 fråga' : `${count} frågor`})`
  }

  if (state === 'playing' && at) {
    return {
      current: at,
      primary: { kind: 'open', target: at, label: `Visa fråga ${at.overall}` },
      side: { kind: 'pause', label: 'Pausa låten' },
      later: laterFrom(at),
    }
  }
  if (state === 'open' && at) {
    const left = secondsLeft === null ? '' : ` · ${secondsLeft} s kvar`
    return {
      current: at,
      primary: { kind: 'wait', label: `Fråga ${at.overall} är öppen${left}` },
      side: { kind: 'close', label: 'Stäng frågan nu' },
      later: laterFrom(at),
    }
  }
  if (state === 'closed' && at) {
    const next = after(at)
    const primary: QuizAction = !next
      ? done
      : next.startsSong
        ? playAction(next)
        : { kind: 'open', target: next, label: `Visa fråga ${next.overall} · samma låt` }
    return { current: at, primary, side: next ? { kind: 'pause', label: 'Pausa låten' } : null, later: laterFrom(next) }
  }
  // idle: fortsätt där quizet pausades, annars från början.
  const target = at ?? plan[0] ?? null
  if (!target) return { current: null, primary: done, side: null, later: 'Sista frågan' }
  return {
    current: target,
    primary: playAction(target),
    side: nextSong(plan, target) ? { kind: 'skip', label: 'Hoppa över låten' } : null,
    later: laterFrom(target),
  }
}
