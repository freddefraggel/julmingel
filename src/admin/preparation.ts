// Förbered kvällen: utkastet som admin redigerar, och hur det blir till
// config/ och secret/. Rena funktioner utan Firebase, så att de kan testas.
import { parseTrackLink } from '../spotify'
import type { Choice, Criterion, EventConfig, GloggNumber, GuestClass, Question, Song } from '../types'

export const CLASSES: readonly GuestClass[] = ['vanlig', 'alkfri']
export const CHOICES: readonly Choice[] = ['A', 'B', 'C', 'D']

export type DraftGlogg = { gId: string; name: string; description: string; imageId?: string }
export type DraftCriterion = { cId: string; name: string; lowIsGood: boolean }

export type Options = Record<Choice, string>

export type DraftQuestion = {
  qId: string
  text: string
  answerType: Question['answerType']
  /** Svaren som text. Sparas när svarstypen är Text. */
  texts: Options
  /** Svaren som imageId. Sparas när svarstypen är Bild. Båda behålls, så att admin kan byta fram och tillbaka. */
  images: Options
  /** Rätt svar. Sparas bara i secret/correct. */
  correct: Choice | null
}

export type DraftSong = {
  songId: string
  /** Spotify-länken som admin skrev den. Blir `spotify:track:<id>` när den sparas. */
  link: string
  title: string
  artist: string
  /** ”Starta vid”, t.ex. ”0:30” eller ”45”. */
  start: string
  /** Tid per fråga i sekunder, som text i fältet. */
  seconds: string
  questions: DraftQuestion[]
}

/** Det admin redigerar. Glöggernas plats i listan är deras nummer, alltså serveringsordningen. */
export type Draft = {
  name: string
  joinCode: string
  gloggs: Record<GuestClass, DraftGlogg[]>
  criteria: DraftCriterion[]
  /** Låtarna i spelordning, med sina frågor i ordning. */
  songs: DraftSong[]
}

/** Det som läses från databasen. */
export type Saved = {
  config: EventConfig | null
  joinCode: string | null
  numbers: Partial<Record<GuestClass, Record<GloggNumber, string>>> | null
  correct?: Record<string, Choice> | null
}

/** Skrivningarna under /events/{eventId}, i ett enda update()-anrop. */
export type SavePayload = {
  'config/name': string
  'config/gloggs': Record<string, { class: GuestClass; name: string; description: string; imageId?: string }>
  'config/criteria': Record<string, Criterion>
  'config/songs': Record<string, Song>
  'config/questions': Record<string, Question>
  'secret/numbers': Record<GuestClass, Record<GloggNumber, string>>
  'secret/correct': Record<string, Choice>
  'secret/joinCode': string
}

export const DEFAULT_SECONDS = 30

/** Kriterierna från designen (docs/design/Ranka.dc.html). Förval när en kväll saknar kriterier. */
export const DEFAULT_CRITERIA: readonly Omit<DraftCriterion, 'cId'>[] = [
  { name: 'Julkänsla', lowIsGood: false },
  { name: 'Mysfaktor', lowIsGood: false },
  { name: 'Doft', lowIsGood: false },
  { name: 'Sliskighet', lowIsGood: true },
  { name: 'Kvalmighet', lowIsGood: true },
  { name: 'Påtår?', lowIsGood: false },
]

/**
 * Lägger in designens kriterier när utkastet inte har några. De är osparade
 * tills admin trycker på Spara, och kan tas bort eller kompletteras som vanligt.
 */
export function withDefaultCriteria(draft: Draft, newId: () => string): Draft {
  if (draft.criteria.length > 0) return draft
  return { ...draft, criteria: DEFAULT_CRITERIA.map((c) => ({ cId: newId(), ...c })) }
}

const emptyOptions = (): Options => ({ A: '', B: '', C: '', D: '' })

export function newSong(songId: string): DraftSong {
  return { songId, link: '', title: '', artist: '', start: '0:00', seconds: String(DEFAULT_SECONDS), questions: [] }
}

export function newQuestion(qId: string): DraftQuestion {
  return { qId, text: '', answerType: 'text', texts: emptyOptions(), images: emptyOptions(), correct: null }
}

/** ”0:30” → 30000, ”1:05” → 65000, ”45” → 45000. Ogiltigt → null. */
export function parseStart(text: string): number | null {
  const t = text.trim().replace(',', '.')
  const clock = /^(\d+):([0-5]\d)$/.exec(t)
  if (clock) return (Number(clock[1]) * 60 + Number(clock[2])) * 1000
  if (/^\d+(\.\d+)?$/.test(t)) return Math.round(Number(t) * 1000)
  return null
}

/** 30000 → ”0:30”. */
export function formatStart(ms: number): string {
  const seconds = Math.max(0, Math.round(ms / 1000))
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`
}

/** Tid per fråga: heltal 5–600 sekunder, annars null. */
export function parseSeconds(text: string): number | null {
  const t = text.trim().replace(/\s*s$/, '')
  if (!/^\d+$/.test(t)) return null
  const n = Number(t)
  return n >= 5 && n <= 600 ? n : null
}

/** Antal låtar och frågor, till rubriken ”Musikquiz · 5 låtar · 12 frågor”. */
export function quizSummary(songs: readonly DraftSong[]): string {
  const questions = songs.reduce((n, s) => n + s.questions.length, 0)
  const s = songs.length === 1 ? '1 låt' : `${songs.length} låtar`
  const q = questions === 1 ? '1 fråga' : `${questions} frågor`
  return `Musikquiz · ${s} · ${q}`
}

/** Frågans nummer i hela quizet (1, 2, …), i låtarnas ordning. */
export function questionNumber(songs: readonly DraftSong[], songIndex: number, questionIndex: number): number {
  return songs.slice(0, songIndex).reduce((n, s) => n + s.questions.length, 0) + questionIndex + 1
}

/**
 * Gör om sparade data till ett utkast. Glöggerna sorteras efter sina nummer i
 * secret/numbers. Glögger utan nummer hamnar sist, i gId-ordning.
 */
export function toDraft(saved: Saved, eventId: string): Draft {
  const gloggs = saved.config?.gloggs ?? {}
  const draft: Draft = {
    name: saved.config?.name ?? eventId,
    joinCode: saved.joinCode ?? '',
    gloggs: { vanlig: [], alkfri: [] },
    criteria: Object.entries(saved.config?.criteria ?? {})
      .sort(([a, x], [b, y]) => x.order - y.order || (a < b ? -1 : 1))
      .map(([cId, c]) => ({ cId, name: c.name, lowIsGood: c.lowIsGood === true })),
    songs: toDraftSongs(saved),
  }

  for (const cls of CLASSES) {
    const placed = new Set<string>()
    const numbered = Object.entries(saved.numbers?.[cls] ?? {})
      .map(([number, gId]) => ({ number: Number(number), gId }))
      .filter(({ number, gId }) => Number.isFinite(number) && gloggs[gId]?.class === cls)
      .sort((a, b) => a.number - b.number)
    for (const { gId } of numbered) {
      if (placed.has(gId)) continue
      placed.add(gId)
      draft.gloggs[cls].push(toDraftGlogg(gId, gloggs[gId]!))
    }
    const rest = Object.keys(gloggs)
      .filter((gId) => gloggs[gId]!.class === cls && !placed.has(gId))
      .sort()
    for (const gId of rest) draft.gloggs[cls].push(toDraftGlogg(gId, gloggs[gId]!))
  }
  return draft
}

/** Låtar i `order`, med sina frågor i `order`. Frågor till en låt som inte finns hoppas över. */
function toDraftSongs(saved: Saved): DraftSong[] {
  const byOrder = <T extends { order: number }>([a, x]: [string, T], [b, y]: [string, T]) =>
    x.order - y.order || (a < b ? -1 : 1)
  const questions = Object.entries(saved.config?.questions ?? {}).sort(byOrder)
  return Object.entries(saved.config?.songs ?? {})
    .sort(byOrder)
    .map(([songId, s]) => ({
      songId,
      link: s.spotifyUri ?? '',
      title: s.title ?? '',
      artist: s.artist ?? '',
      start: formatStart(s.startMs ?? 0),
      seconds: String(s.secondsPerQuestion ?? DEFAULT_SECONDS),
      questions: questions
        .filter(([, q]) => q.songId === songId)
        .map(([qId, q]) => {
          const options = { ...emptyOptions(), ...q.options }
          const image = q.answerType === 'image'
          return {
            qId,
            text: q.text ?? '',
            answerType: image ? 'image' : 'text',
            texts: image ? emptyOptions() : options,
            images: image ? options : emptyOptions(),
            correct: saved.correct?.[qId] ?? null,
          } satisfies DraftQuestion
        }),
    }))
}

function toDraftGlogg(gId: string, g: NonNullable<EventConfig['gloggs']>[string]): DraftGlogg {
  return { gId, name: g.name ?? '', description: g.description ?? '', ...(g.imageId ? { imageId: g.imageId } : {}) }
}

/** Skrivningarna för ett utkast. Numren börjar på 1 i varje klass. Texterna trimmas. */
export function toPayload(draft: Draft): SavePayload {
  const payload: SavePayload = {
    'config/name': draft.name.trim(),
    'config/gloggs': {},
    'config/criteria': {},
    'config/songs': {},
    'config/questions': {},
    'secret/numbers': { vanlig: {}, alkfri: {} },
    'secret/correct': {},
    'secret/joinCode': draft.joinCode.trim(),
  }
  let order = 0
  draft.songs.forEach((s, i) => {
    const title = s.title.trim()
    const artist = s.artist.trim()
    payload['config/songs'][s.songId] = {
      order: i + 1,
      spotifyUri: parseTrackLink(s.link) ?? s.link.trim(),
      ...(title ? { title } : {}),
      ...(artist ? { artist } : {}),
      startMs: parseStart(s.start) ?? 0,
      secondsPerQuestion: parseSeconds(s.seconds) ?? DEFAULT_SECONDS,
    }
    for (const q of s.questions) {
      const source = q.answerType === 'image' ? q.images : q.texts
      payload['config/questions'][q.qId] = {
        songId: s.songId,
        order: ++order,
        text: q.text.trim(),
        answerType: q.answerType,
        options: { A: source.A.trim(), B: source.B.trim(), C: source.C.trim(), D: source.D.trim() },
      }
      if (q.correct) payload['secret/correct'][q.qId] = q.correct
    }
  })
  for (const cls of CLASSES) {
    draft.gloggs[cls].forEach((g, i) => {
      payload['config/gloggs'][g.gId] = {
        class: cls,
        name: g.name.trim(),
        description: g.description.trim(),
        ...(g.imageId ? { imageId: g.imageId } : {}),
      }
      payload['secret/numbers'][cls][String(i + 1)] = g.gId
    })
  }
  draft.criteria.forEach((c, i) => {
    payload['config/criteria'][c.cId] = { name: c.name.trim(), order: i + 1, lowIsGood: c.lowIsGood }
  })
  return payload
}

/** Det som måste rättas innan utkastet kan sparas, som texter till admin. Tom lista = går att spara. */
export function problems(draft: Draft): string[] {
  const list: string[] = []
  if (!draft.name.trim()) list.push('Kvällen behöver ett namn.')
  const code = draft.joinCode.trim()
  if (!code) list.push('Kvällen behöver en kod till QR-länken.')
  else if (/\s/.test(code)) list.push('Koden får inte innehålla mellanslag.')
  for (const cls of CLASSES) {
    const missing = draft.gloggs[cls].findIndex((g) => !g.name.trim())
    if (missing >= 0) list.push(`${CLASS_LABEL[cls]} glögg ${missing + 1} saknar namn.`)
  }
  if (draft.criteria.some((c) => !c.name.trim())) list.push('Alla kriterier behöver ett namn.')
  draft.songs.forEach((s, i) => {
    const song = `Låt ${i + 1}`
    if (!parseTrackLink(s.link)) list.push(`${song}: Spotify-länken ska se ut som https://open.spotify.com/track/…`)
    if (parseStart(s.start) === null) list.push(`${song}: ”Starta vid” ska vara minuter:sekunder, t.ex. 0:30.`)
    if (parseSeconds(s.seconds) === null) list.push(`${song}: tid per fråga ska vara 5–600 sekunder.`)
    if (s.questions.length === 0) list.push(`${song} har inga frågor.`)
    s.questions.forEach((q, j) => {
      const question = `Fråga ${questionNumber(draft.songs, i, j)}`
      if (!q.text.trim()) list.push(`${question} saknar text.`)
      const source = q.answerType === 'image' ? q.images : q.texts
      if (CHOICES.some((c) => !source[c].trim()))
        list.push(`${question} behöver ${q.answerType === 'image' ? 'en bild' : 'en text'} på alla svar A–D.`)
      if (!q.correct) list.push(`${question}: tryck på det rätta svaret.`)
    })
  })
  return list
}

/** Bilder som inte längre används när utkastet sparas, t.ex. för borttagna glögger eller bildsvar. */
export function unusedImages(saved: Saved, draft: Draft): string[] {
  const kept = new Set<string | undefined>(CLASSES.flatMap((cls) => draft.gloggs[cls].map((g) => g.imageId)))
  for (const s of draft.songs) {
    for (const q of s.questions) if (q.answerType === 'image') CHOICES.forEach((c) => kept.add(q.images[c]))
  }
  const before: (string | undefined)[] = Object.values(saved.config?.gloggs ?? {}).map((g) => g.imageId)
  for (const q of Object.values(saved.config?.questions ?? {})) {
    if (q.answerType === 'image') before.push(...CHOICES.map((c) => q.options?.[c]))
  }
  return [...new Set(before)].filter((id): id is string => !!id && !kept.has(id))
}

export const CLASS_LABEL: Record<GuestClass, string> = { vanlig: 'Vanlig', alkfri: 'Alkoholfri' }

/** Flyttar ett element ett steg upp (−1) eller ned (+1). Utanför listan händer inget. */
export function move<T>(list: readonly T[], index: number, step: -1 | 1): T[] {
  const to = index + step
  if (index < 0 || index >= list.length || to < 0 || to >= list.length) return [...list]
  const next = [...list]
  ;[next[index], next[to]] = [next[to]!, next[index]!]
  return next
}
