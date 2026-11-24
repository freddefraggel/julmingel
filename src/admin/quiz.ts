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

/** Frågan efter `qId`, eller den första om ingen är öppnad än. null när quizet är slut. */
export function nextQuestion(plan: readonly PlannedQuestion[], qId: string | undefined): PlannedQuestion | null {
  if (!qId) return plan[0] ?? null
  const index = plan.findIndex((p) => p.qId === qId)
  return index < 0 ? (plan[0] ?? null) : (plan[index + 1] ?? null)
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
