import { describe, expect, it } from 'vitest'
import {
  formatStart,
  move,
  newQuestion,
  newSong,
  parseSeconds,
  parseStart,
  problems,
  questionNumber,
  quizSummary,
  toDraft,
  toPayload,
  unusedImages,
  withDefaultCriteria,
  type Draft,
  type Saved,
} from './preparation'

const saved: Saved = {
  config: {
    name: 'Julmingel',
    joinOpen: true,
    gloggs: {
      gx: { class: 'vanlig', name: 'Vit', description: 'Kardemumma', imageId: 'i1' },
      ga: { class: 'vanlig', name: 'Röd', description: '' },
      gz: { class: 'vanlig', name: 'Utan nummer', description: '' },
      gb: { class: 'alkfri', name: 'Äpple', description: '' },
    },
    criteria: {
      c2: { name: 'Sötma', order: 2, lowIsGood: true },
      c1: { name: 'Smak', order: 1, lowIsGood: false },
    },
  },
  joinCode: 'glogg',
  // Nummer 1 är gx och 2 är ga, så ordningen styrs inte av gId. gb står fel i vanlig och hoppas över där.
  numbers: { vanlig: { '2': 'ga', '1': 'gx', '3': 'gb' }, alkfri: { '1': 'gb' } },
}

describe('toDraft', () => {
  it('sorterar glöggerna efter numret och lägger glögger utan nummer sist', () => {
    const draft = toDraft(saved, 'demo')
    expect(draft.gloggs.vanlig.map((g) => g.gId)).toEqual(['gx', 'ga', 'gz'])
    expect(draft.gloggs.alkfri.map((g) => g.gId)).toEqual(['gb'])
    expect(draft.gloggs.vanlig[0]).toEqual({ gId: 'gx', name: 'Vit', description: 'Kardemumma', imageId: 'i1' })
  })

  it('sorterar kriterierna efter order', () => {
    expect(toDraft(saved, 'demo').criteria).toEqual([
      { cId: 'c1', name: 'Smak', lowIsGood: false },
      { cId: 'c2', name: 'Sötma', lowIsGood: true },
    ])
  })

  it('klarar en tom kväll', () => {
    expect(toDraft({ config: null, joinCode: null, numbers: null }, 'demo')).toEqual({
      name: 'demo',
      joinCode: '',
      gloggs: { vanlig: [], alkfri: [] },
      criteria: [],
      songs: [],
    })
  })
})

describe('toPayload', () => {
  it('ger nummer efter platsen i listan och trimmar texterna', () => {
    const draft = toDraft(saved, 'demo')
    draft.gloggs.vanlig = move(draft.gloggs.vanlig, 2, -1) // gz före ga
    draft.name = '  Glöggkväll  '
    const payload = toPayload(draft)
    expect(payload['secret/numbers']).toEqual({ vanlig: { '1': 'gx', '2': 'gz', '3': 'ga' }, alkfri: { '1': 'gb' } })
    expect(payload['config/name']).toBe('Glöggkväll')
    expect(payload['config/gloggs'].gx).toEqual({ class: 'vanlig', name: 'Vit', description: 'Kardemumma', imageId: 'i1' })
    expect(payload['config/gloggs'].ga).toEqual({ class: 'vanlig', name: 'Röd', description: '' })
    expect(payload['secret/joinCode']).toBe('glogg')
  })

  it('lägger aldrig numren i config/', () => {
    const payload = toPayload(toDraft(saved, 'demo'))
    expect(JSON.stringify(payload['config/gloggs'])).not.toMatch(/number|"[123]"/)
  })

  it('ger kriterierna order efter platsen i listan', () => {
    const draft = toDraft(saved, 'demo')
    draft.criteria = move(draft.criteria, 0, 1)
    expect(toPayload(draft)['config/criteria']).toEqual({
      c2: { name: 'Sötma', order: 1, lowIsGood: true },
      c1: { name: 'Smak', order: 2, lowIsGood: false },
    })
  })

  it('sparat och läst tillbaka ger samma utkast', () => {
    const draft = toDraft(saved, 'demo')
    const payload = toPayload(draft)
    const again = toDraft(
      {
        config: { name: payload['config/name'], joinOpen: true, gloggs: payload['config/gloggs'], criteria: payload['config/criteria'] },
        joinCode: payload['secret/joinCode'],
        numbers: payload['secret/numbers'],
      },
      'demo',
    )
    expect(again).toEqual(draft)
  })
})

describe('problems', () => {
  const ok = (): Draft => toDraft(saved, 'demo')

  it('godkänner ett komplett utkast', () => {
    expect(problems(ok())).toEqual([])
  })

  it('kräver namn, kod utan mellanslag och namn på glögger och kriterier', () => {
    const draft = ok()
    draft.name = ' '
    draft.joinCode = 'två ord'
    draft.gloggs.alkfri[0]!.name = ''
    draft.criteria[1]!.name = ' '
    expect(problems(draft)).toEqual([
      'Kvällen behöver ett namn.',
      'Koden får inte innehålla mellanslag.',
      'Alkoholfri glögg 1 saknar namn.',
      'Alla kriterier behöver ett namn.',
    ])
    draft.joinCode = ''
    expect(problems(draft)).toContain('Kvällen behöver en kod till QR-länken.')
  })
})

describe('unusedImages', () => {
  it('ger bilder för borttagna glögger, inte för dem som är kvar', () => {
    const draft = toDraft(saved, 'demo')
    expect(unusedImages(saved, draft)).toEqual([])
    draft.gloggs.vanlig = draft.gloggs.vanlig.filter((g) => g.gId !== 'gx')
    expect(unusedImages(saved, draft)).toEqual(['i1'])
  })
})

describe('move', () => {
  it('flyttar upp och ned men inte utanför listan', () => {
    expect(move(['a', 'b', 'c'], 1, -1)).toEqual(['b', 'a', 'c'])
    expect(move(['a', 'b', 'c'], 1, 1)).toEqual(['a', 'c', 'b'])
    expect(move(['a', 'b'], 0, -1)).toEqual(['a', 'b'])
    expect(move(['a', 'b'], 1, 1)).toEqual(['a', 'b'])
  })
})

const TRACK = 'spotify:track:2FRnf9qhLbvw8fu4IBXx78'

const quizSaved: Saved = {
  config: {
    name: 'Julmingel',
    joinOpen: true,
    songs: {
      s2: { order: 2, spotifyUri: TRACK, startMs: 0, secondsPerQuestion: 20 },
      s1: { order: 1, spotifyUri: TRACK, title: 'Last Christmas', artist: 'Wham!', startMs: 45_000, secondsPerQuestion: 30 },
    },
    questions: {
      q3: { songId: 's2', order: 3, text: 'Film?', answerType: 'image', options: { A: 'i1', B: 'i2', C: 'i3', D: 'i4' } },
      q1: { songId: 's1', order: 1, text: 'Årtal?', answerType: 'text', options: { A: '1984', B: '1985', C: '1986', D: '1987' } },
      q2: { songId: 's1', order: 2, text: 'Artist?', answerType: 'text', options: { A: 'Wham!', B: 'ABBA', C: 'Queen', D: 'Toto' } },
      qx: { songId: 'borta', order: 4, text: 'Låten finns inte', answerType: 'text', options: { A: '', B: '', C: '', D: '' } },
    },
  },
  joinCode: 'glogg',
  numbers: null,
  correct: { q1: 'A', q2: 'A', q3: 'C' },
}

describe('låtar och frågor', () => {
  it('toDraft ger låtarna i spelordning med frågorna och rätt svar', () => {
    const draft = toDraft(quizSaved, 'demo')
    expect(draft.songs.map((s) => [s.songId, s.start, s.seconds, s.questions.map((q) => q.qId)])).toEqual([
      ['s1', '0:45', '30', ['q1', 'q2']],
      ['s2', '0:00', '20', ['q3']],
    ])
    expect(draft.songs[0]).toMatchObject({ link: TRACK, title: 'Last Christmas', artist: 'Wham!' })
    expect(draft.songs[1]!.questions[0]).toMatchObject({
      answerType: 'image',
      images: { A: 'i1', B: 'i2', C: 'i3', D: 'i4' },
      texts: { A: '', B: '', C: '', D: '' },
      correct: 'C',
    })
  })

  it('toPayload ger order över hela quizet och facit bara i secret/correct', () => {
    const draft = toDraft(quizSaved, 'demo')
    draft.songs = move(draft.songs, 0, 1)
    draft.songs[0]!.link = 'https://open.spotify.com/intl-sv/track/2FRnf9qhLbvw8fu4IBXx78?si=abc'
    draft.songs[0]!.start = '1:05'
    const payload = toPayload(draft)
    expect(payload['config/songs'].s2).toEqual({ order: 1, spotifyUri: TRACK, startMs: 65_000, secondsPerQuestion: 20 })
    expect(payload['config/songs'].s1).toMatchObject({ order: 2, title: 'Last Christmas', artist: 'Wham!' })
    expect(Object.entries(payload['config/questions']).map(([id, q]) => [id, q.songId, q.order])).toEqual([
      ['q3', 's2', 1],
      ['q1', 's1', 2],
      ['q2', 's1', 3],
    ])
    expect(payload['secret/correct']).toEqual({ q1: 'A', q2: 'A', q3: 'C' })
    expect(JSON.stringify(payload['config/questions'])).not.toMatch(/correct/)
  })

  it('sparar svaren för den valda svarstypen men behåller båda i utkastet', () => {
    const draft = toDraft(quizSaved, 'demo')
    const q = draft.songs[0]!.questions[0]!
    q.answerType = 'image'
    q.images = { A: 'j1', B: 'j2', C: 'j3', D: 'j4' }
    expect(toPayload(draft)['config/questions'].q1!.options).toEqual({ A: 'j1', B: 'j2', C: 'j3', D: 'j4' })
    q.answerType = 'text'
    expect(toPayload(draft)['config/questions'].q1!.options).toEqual({ A: '1984', B: '1985', C: '1986', D: '1987' })
  })

  it('sparat och läst tillbaka ger samma quiz', () => {
    const draft = toDraft(quizSaved, 'demo')
    const payload = toPayload(draft)
    const again = toDraft(
      {
        config: { name: 'Julmingel', joinOpen: true, songs: payload['config/songs'], questions: payload['config/questions'] },
        joinCode: 'glogg',
        numbers: null,
        correct: payload['secret/correct'],
      },
      'demo',
    )
    expect(again.songs).toEqual(draft.songs)
  })

  it('problems kräver länk, tider, frågetext, alla svar och rätt svar', () => {
    const draft = toDraft(quizSaved, 'demo')
    expect(problems(draft)).toEqual([])
    const song = newSong('s9')
    song.link = 'https://example.com/låt'
    song.start = '1:75'
    song.seconds = '2'
    draft.songs.push(song)
    const q = draft.songs[0]!.questions[1]!
    q.text = ' '
    q.texts.C = ''
    q.correct = null
    draft.songs[1]!.questions[0]!.images.D = ''
    expect(problems(draft)).toEqual([
      'Fråga 2 saknar text.',
      'Fråga 2 behöver en text på alla svar A–D.',
      'Fråga 2: tryck på det rätta svaret.',
      'Fråga 3 behöver en bild på alla svar A–D.',
      'Låt 3: Spotify-länken ska se ut som https://open.spotify.com/track/…',
      'Låt 3: ”Starta vid” ska vara minuter:sekunder, t.ex. 0:30.',
      'Låt 3: tid per fråga ska vara 5–600 sekunder.',
      'Låt 3 har inga frågor.',
    ])
  })

  it('unusedImages tar med bildsvar som tagits bort eller bytts mot text', () => {
    const draft = toDraft(quizSaved, 'demo')
    expect(unusedImages(quizSaved, draft)).toEqual([])
    draft.songs[1]!.questions[0]!.images.B = 'ny'
    expect(unusedImages(quizSaved, draft)).toEqual(['i2'])
    draft.songs[1]!.questions[0]!.answerType = 'text'
    expect(unusedImages(quizSaved, draft)).toEqual(['i1', 'i2', 'i3', 'i4'])
  })

  it('newQuestion börjar som textfråga utan rätt svar', () => {
    expect(newQuestion('q')).toEqual({
      qId: 'q',
      text: '',
      answerType: 'text',
      texts: { A: '', B: '', C: '', D: '' },
      images: { A: '', B: '', C: '', D: '' },
      correct: null,
    })
  })
})

describe('tider och rubrik', () => {
  it.each([
    ['0:30', 30_000],
    ['1:05', 65_000],
    ['45', 45_000],
    ['2,5', 2_500],
    [' 0:00 ', 0],
    ['1:60', null],
    ['abc', null],
    ['', null],
  ])('parseStart(%j) = %s', (text, ms) => {
    expect(parseStart(text)).toBe(ms)
  })

  it('formatStart', () => {
    expect(formatStart(65_000)).toBe('1:05')
    expect(formatStart(0)).toBe('0:00')
  })

  it('parseSeconds tar 5–600 hela sekunder, med eller utan ”s”', () => {
    expect(parseSeconds('30')).toBe(30)
    expect(parseSeconds('30 s')).toBe(30)
    expect(parseSeconds('4')).toBeNull()
    expect(parseSeconds('601')).toBeNull()
    expect(parseSeconds('2.5')).toBeNull()
  })

  it('quizSummary och questionNumber', () => {
    const draft = toDraft(quizSaved, 'demo')
    expect(quizSummary(draft.songs)).toBe('Musikquiz · 2 låtar · 3 frågor')
    expect(quizSummary([])).toBe('Musikquiz · 0 låtar · 0 frågor')
    expect(quizSummary(draft.songs.slice(1))).toBe('Musikquiz · 1 låt · 1 fråga')
    expect(questionNumber(draft.songs, 1, 0)).toBe(3)
  })
})

describe('withDefaultCriteria', () => {
  it('lägger in designens sex kriterier när utkastet saknar kriterier', () => {
    let n = 0
    const draft = withDefaultCriteria(toDraft({ config: null, joinCode: null, numbers: null }, 'demo'), () => `k${++n}`)
    expect(draft.criteria).toEqual([
      { cId: 'k1', name: 'Julkänsla', lowIsGood: false },
      { cId: 'k2', name: 'Mysfaktor', lowIsGood: false },
      { cId: 'k3', name: 'Doft', lowIsGood: false },
      { cId: 'k4', name: 'Sliskighet', lowIsGood: true },
      { cId: 'k5', name: 'Kvalmighet', lowIsGood: true },
      { cId: 'k6', name: 'Påtår?', lowIsGood: false },
    ])
  })

  it('rör inte kriterier som redan finns', () => {
    const draft = toDraft(saved, 'demo')
    expect(withDefaultCriteria(draft, () => 'ny')).toBe(draft)
  })
})
