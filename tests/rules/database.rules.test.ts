import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
  type RulesTestEnvironment,
} from '@firebase/rules-unit-testing'
import { get, ref, serverTimestamp, set, update } from 'firebase/database'
import { readFileSync } from 'node:fs'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { resetChanges, stageChanges, wrapupStepChanges } from '../../src/live'

const E = 'events/test'
let env: RulesTestEnvironment

/** Porten som emulators:exec startade databasemulatorn på, annars 9000 som i firebase.json. */
function emulatorPort(): number {
  return Number(process.env.FIREBASE_DATABASE_EMULATOR_HOST?.split(':').pop()) || 9000
}

beforeAll(async () => {
  env = await initializeTestEnvironment({
    // Eget projekt-id, så att testerna aldrig skriver i samma databas som npm run dev använder.
    projectId: 'demo-julmingel-rules',
    database: { rules: readFileSync('database.rules.json', 'utf8'), host: '127.0.0.1', port: emulatorPort() },
  })
})

afterAll(async () => {
  await env.cleanup()
})

beforeEach(async () => {
  await env.clearDatabase()
  await env.withSecurityRulesDisabled(async (ctx) => {
    await set(ref(ctx.database(), '/'), {
      admins: { admin: true },
      events: {
        test: {
          config: {
            name: 'Test',
            joinOpen: true,
            criteria: { c1: { name: 'Smak', order: 1, lowIsGood: false } },
            gloggs: { g1: { class: 'vanlig', name: 'A', description: '' } },
          },
          secret: { joinCode: 'hemlig', correct: { q1: 'B' }, numbers: { vanlig: { 1: 'g1' } } },
          live: { stage: 'evening', quiz: { state: 'open', songId: 's1', qId: 'q1', openedAt: Date.now(), durationMs: 60_000 } },
          guests: { anna: { name: 'Anna', class: 'vanlig', joinCode: 'hemlig', joinedAt: 1 } },
        },
      },
    })
  })
})

const db = (uid?: string) => (uid ? env.authenticatedContext(uid) : env.unauthenticatedContext()).database()

function join(uid: string, joinCode: string) {
  return set(ref(db(uid), `${E}/guests/${uid}`), {
    name: 'Bertil',
    class: 'vanlig',
    joinCode,
    joinedAt: serverTimestamp(),
  })
}

/** Läser utan regler, för att kontrollera vad som sparats. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- testdata
async function read(path: string): Promise<any> {
  let value: unknown
  await env.withSecurityRulesDisabled(async (ctx) => {
    value = (await get(ref(ctx.database(), path))).val()
  })
  return value
}

async function setLive(live: object) {
  await env.withSecurityRulesDisabled((ctx) => set(ref(ctx.database(), `${E}/live`), live))
}

describe('registrering', () => {
  it('släpper in en gäst med rätt kod', async () => {
    await assertSucceeds(join('bertil', 'hemlig'))
  })

  it('nekar en gäst utan rätt kod', async () => {
    await assertFails(join('bertil', 'fel'))
  })

  it('nekar när registreringen är stängd', async () => {
    await env.withSecurityRulesDisabled((ctx) => set(ref(ctx.database(), `${E}/config/joinOpen`), false))
    await assertFails(join('bertil', 'hemlig'))
  })

  it('inloggad användare får läsa om registreringen är öppen, men inte resten av config', async () => {
    await assertSucceeds(get(ref(db('bertil'), `${E}/config/joinOpen`)))
    await assertFails(get(ref(db('bertil'), `${E}/config`)))
    await assertFails(get(ref(db(), `${E}/config/joinOpen`)))
  })

  it('gäst får läsa sin egen post', async () => {
    await assertSucceeds(get(ref(db('anna'), `${E}/guests/anna`)))
  })

  it('gäst kan inte registrera sig två gånger', async () => {
    await assertSucceeds(join('bertil', 'hemlig'))
    await assertFails(join('bertil', 'hemlig'))
  })

  it('nekar för långt namn', async () => {
    await assertFails(
      set(ref(db('bertil'), `${E}/guests/bertil`), { name: 'x'.repeat(31), class: 'vanlig', joinCode: 'hemlig', joinedAt: serverTimestamp() }),
    )
  })

  it('nekar att registrera någon annan', async () => {
    await assertFails(
      set(ref(db('bertil'), `${E}/guests/cecilia`), { name: 'C', class: 'vanlig', joinCode: 'hemlig', joinedAt: serverTimestamp() }),
    )
  })
})

describe('läsning', () => {
  it('gäst får läsa config och live', async () => {
    await assertSucceeds(get(ref(db('anna'), `${E}/config`)))
    await assertSucceeds(get(ref(db('anna'), `${E}/live`)))
  })

  it('gäst får inte läsa secret/', async () => {
    await assertFails(get(ref(db('anna'), `${E}/secret`)))
    await assertFails(get(ref(db('anna'), `${E}/secret/correct`)))
  })

  it('gäst får inte läsa andra gäster', async () => {
    await assertFails(get(ref(db('anna'), `${E}/guests`)))
  })

  it('okänd användare får inte läsa något', async () => {
    await assertFails(get(ref(db(), `${E}/config`)))
    await assertFails(get(ref(db('okand'), `${E}/live`)))
  })

  it('admin får läsa allt i eventet', async () => {
    await assertSucceeds(get(ref(db('admin'), E)))
  })

  it('ingen får läsa /admins', async () => {
    await assertFails(get(ref(db('admin'), 'admins')))
  })
})

describe('svar i quizet', () => {
  const answer = (q: string, choice = 'A') => set(ref(db('anna'), `${E}/answers/${q}/anna`), { choice, at: serverTimestamp() })

  it('godkänner svar på den öppna frågan', async () => {
    await assertSucceeds(answer('q1'))
  })

  it('nekar svar på fel fråga', async () => {
    await assertFails(answer('q2'))
  })

  it('nekar svar efter sluttiden', async () => {
    await setLive({ stage: 'evening', quiz: { state: 'open', songId: 's1', qId: 'q1', openedAt: Date.now() - 120_000, durationMs: 60_000 } })
    await assertFails(answer('q1'))
  })

  it('nekar tidsstämpel från klientens klocka', async () => {
    await assertFails(set(ref(db('anna'), `${E}/answers/q1/anna`), { choice: 'A', at: Date.now() }))
  })

  it('admin ser alla svar live, gästen bara sitt eget', async () => {
    await assertSucceeds(answer('q1'))
    await assertSucceeds(get(ref(db('admin'), `${E}/answers/q1`)))
    await assertSucceeds(get(ref(db('anna'), `${E}/answers/q1/anna`)))
    await assertFails(get(ref(db('anna'), `${E}/answers/q1`)))
  })

  it('admin skriver antalet svar till live/answered, gäster läser men skriver inte', async () => {
    const answered = { qId: 'q1', count: 3, total: 5 }
    await assertSucceeds(set(ref(db('admin'), `${E}/live/answered`), answered))
    await assertSucceeds(get(ref(db('anna'), `${E}/live/answered`)))
    await assertFails(set(ref(db('anna'), `${E}/live/answered`), { ...answered, count: 5 }))
  })

  it('nekar ogiltigt svarsalternativ', async () => {
    await assertFails(answer('q1', 'E'))
  })
})

describe('frågetider i secret/quizTimes', () => {
  // Samma skrivning som openQuestion() i src/data/quiz.ts
  const open = (uid: string, live: object, timing: object) =>
    update(ref(db(uid), E), { 'live/quiz': live, 'secret/quizTimes/q2': timing })
  const timing = () => ({ openedAt: serverTimestamp(), durationMs: 20_000 })

  it('admin öppnar en fråga och sparar tiden i samma anrop', async () => {
    await assertSucceeds(open('admin', { state: 'open', songId: 's1', qId: 'q2', ...timing() }, timing()))
    const saved = await read(E)
    expect(saved.secret.quizTimes.q2).toEqual({ openedAt: saved.live.quiz.openedAt, durationMs: 20_000 })
  })

  it('nekar live/quiz utan matchande tid i secret/quizTimes', async () => {
    await assertFails(set(ref(db('admin'), `${E}/live/quiz`), { state: 'open', songId: 's1', qId: 'q2', ...timing() }))
    await assertFails(open('admin', { state: 'open', songId: 's1', qId: 'q2', openedAt: serverTimestamp(), durationMs: 30_000 }, timing()))
  })

  it('nekar starttid från klientens klocka', async () => {
    const t = { openedAt: Date.now(), durationMs: 20_000 }
    await assertFails(open('admin', { state: 'open', songId: 's1', qId: 'q2', ...t }, t))
  })

  it('godkänner att admin skriver om secret/ med befintliga tider', async () => {
    await assertSucceeds(open('admin', { state: 'open', songId: 's1', qId: 'q2', ...timing() }, timing()))
    const secret = await read(`${E}/secret`)
    await assertSucceeds(set(ref(db('admin'), `${E}/secret`), secret))
  })

  it('Spela låt behöver inga tider; Visa fråga utan tider nekas', async () => {
    await assertSucceeds(set(ref(db('admin'), `${E}/live/quiz`), { state: 'playing', songId: 's1', qId: 'q2' }))
    await assertSucceeds(set(ref(db('admin'), `${E}/live/quiz/state`), 'closed'))
    await assertFails(set(ref(db('admin'), `${E}/live/quiz`), { state: 'open', songId: 's1', qId: 'q2' }))
    await assertFails(set(ref(db('admin'), `${E}/live/quiz`), { state: 'paus', songId: 's1', qId: 'q2' }))
  })

  it('gäst får varken läsa eller skriva tiderna', async () => {
    await assertFails(get(ref(db('anna'), `${E}/secret/quizTimes`)))
    await assertFails(open('anna', { state: 'open', songId: 's1', qId: 'q2', ...timing() }, timing()))
  })
})

describe('betyg och gissningar', () => {
  it('godkänner betyg 1–5 under glöggprovningen', async () => {
    await setLive({ stage: 'evening', tasting: { vanlig: { open: true, serving: 1, next: null } } })
    await assertSucceeds(set(ref(db('anna'), `${E}/ratings/anna/1/c1`), 4))
  })

  it('nekar betyg utanför fasen, utanför 1–5 och på nummer som inte finns', async () => {
    await assertFails(set(ref(db('anna'), `${E}/ratings/anna/1/c1`), 4))
    await setLive({ stage: 'evening', tasting: { vanlig: { open: true, serving: 1, next: null } } })
    await assertFails(set(ref(db('anna'), `${E}/ratings/anna/1/c1`), 6))
    await assertFails(set(ref(db('anna'), `${E}/ratings/anna/9/c1`), 3))
  })

  it('sparar ett nummers betyg i ett anrop, som saveRatings(), men inte på okända kriterier', async () => {
    await setLive({ stage: 'evening', tasting: { vanlig: { open: true, serving: 1, next: null } } })
    await assertSucceeds(update(ref(db('anna'), `${E}/ratings/anna/1`), { c1: 4 }))
    await assertFails(update(ref(db('anna'), `${E}/ratings/anna/1`), { c1: 4, okänd: 3 }))
    await assertFails(update(ref(db('anna'), `${E}/ratings/bertil/1`), { c1: 4 }))
  })

  it('gissningar sparas olåsta under gissningen, med glögger som finns, och inte utanför fasen', async () => {
    const guesses = ref(db('anna'), `${E}/guesses/anna`)
    await assertFails(set(guesses, { map: { 1: 'g1' }, locked: false }))
    await setLive({ stage: 'wrapup', wrapup: { step: 'guess' } })
    await assertSucceeds(set(guesses, { map: { 1: 'g1' }, locked: false }))
    await assertFails(set(guesses, { map: { 1: 'finns-inte' }, locked: false }))
    await assertFails(set(ref(db('anna'), `${E}/guesses/bertil`), { map: { 1: 'g1' }, locked: false }))
  })

  it('admin avslöjar glöggordningen i reveal/numbers, gäster läser men skriver inte', async () => {
    await assertSucceeds(set(ref(db('admin'), `${E}/reveal/numbers`), { vanlig: { 1: 'g1' } }))
    await assertSucceeds(get(ref(db('anna'), `${E}/reveal/numbers`)))
    await assertFails(set(ref(db('anna'), `${E}/reveal/numbers`), { vanlig: { 1: 'g1' } }))
  })

  it('låsta gissningar kan inte ändras', async () => {
    await setLive({ stage: 'wrapup', wrapup: { step: 'guess' } })
    const guesses = ref(db('anna'), `${E}/guesses/anna`)
    await assertSucceeds(set(guesses, { map: { 1: 'g1' }, locked: true }))
    await assertFails(update(guesses, { locked: false }))
  })
})

describe('admin styr kvällen', () => {
  it('admin byter läge, öppnar provningen och stänger registreringen', async () => {
    await assertSucceeds(set(ref(db('admin'), `${E}/live/stage`), 'evening'))
    await assertSucceeds(set(ref(db('admin'), `${E}/live/tasting/vanlig/open`), true))
    await assertSucceeds(set(ref(db('admin'), `${E}/live/wrapup`), { step: 'reveal', revealStep: 2 }))
    await assertSucceeds(set(ref(db('admin'), `${E}/config/joinOpen`), false))
  })

  it('nekar okända lägen, även för admin', async () => {
    await assertFails(set(ref(db('admin'), `${E}/live/stage`), 'quiz'))
    await assertFails(set(ref(db('admin'), `${E}/live/tasting/stark/open`), true))
    await assertFails(set(ref(db('admin'), `${E}/live/tasting/vanlig/open`), 'ja'))
    await assertFails(set(ref(db('admin'), `${E}/live/wrapup/step`), 'quiz'))
    await assertFails(set(ref(db('admin'), `${E}/live/wrapup/revealStep`), 5))
  })

  it('gäst får inte byta läge eller öppna registreringen', async () => {
    await assertFails(set(ref(db('anna'), `${E}/live/stage`), 'done'))
    await assertFails(set(ref(db('anna'), `${E}/config/joinOpen`), true))
  })

  it('admin byter klass och tar bort betygen i samma skrivning', async () => {
    await env.withSecurityRulesDisabled((ctx) => set(ref(ctx.database(), `${E}/ratings/anna`), { 1: { c1: 4 } }))
    await assertSucceeds(update(ref(db('admin'), E), { 'guests/anna/class': 'alkfri', 'ratings/anna': null }))
  })

  it('admin kan byta klass även när kvällens kod har ändrats', async () => {
    await env.withSecurityRulesDisabled((ctx) => set(ref(ctx.database(), `${E}/secret/joinCode`), 'ny-kod'))
    await assertSucceeds(update(ref(db('admin'), E), { 'guests/anna/class': 'alkfri', 'ratings/anna': null }))
  })

  it('gäst får inte byta sin egen klass', async () => {
    await assertFails(set(ref(db('anna'), `${E}/guests/anna/class`), 'alkfri'))
  })

  it('admin tar bort en dubblett med svar och betyg', async () => {
    await env.withSecurityRulesDisabled((ctx) =>
      update(ref(ctx.database(), E), { 'ratings/anna': { 1: { c1: 4 } }, 'answers/q1/anna': { choice: 'A', at: 1 } }),
    )
    await assertSucceeds(
      update(ref(db('admin'), E), { 'guests/anna': null, 'ratings/anna': null, 'answers/q1/anna': null, 'guesses/anna': null }),
    )
  })
})

describe('bilder', () => {
  const webp = 'data:image/webp;base64,UklGRg=='

  it('admin får spara komprimerade bilder och länkar, gäster får läsa dem', async () => {
    await assertSucceeds(set(ref(db('admin'), `${E}/assets/i1`), webp))
    await assertSucceeds(set(ref(db('admin'), `${E}/assets/i2`), 'https://example.com/glogg.jpg'))
    await assertSucceeds(get(ref(db('anna'), `${E}/assets`)))
  })

  it('nekar annat än bilder, för stora bilder och gäster som skriver', async () => {
    await assertFails(set(ref(db('admin'), `${E}/assets/i1`), 'http://example.com/glogg.jpg'))
    await assertFails(set(ref(db('admin'), `${E}/assets/i1`), { src: webp }))
    await assertFails(set(ref(db('admin'), `${E}/assets/i1`), webp + 'A'.repeat(200_000)))
    await assertFails(set(ref(db('anna'), `${E}/assets/i1`), webp))
    await assertFails(get(ref(db(), `${E}/assets`)))
  })
})

describe('topplistan', () => {
  const full = { a: { points: 3, stars: 6, rank: 1, name: 'Anna' }, e: { points: 0, stars: 0, rank: 5, name: 'Eva' } }

  it('hela listan i secret/leaderboard går inte att läsa för gäster, results/ går', async () => {
    await assertSucceeds(
      update(ref(db('admin'), E), {
        'secret/leaderboard': full,
        'results/leaderboard': { e: full.e },
        'live/reveal': { step: 0 },
      }),
    )
    await assertFails(get(ref(db('anna'), `${E}/secret/leaderboard`)))
    await assertSucceeds(get(ref(db('anna'), `${E}/results/leaderboard`)))
  })

  it('gäst får inte skriva topplistan eller Kvällens glögg', async () => {
    await assertFails(set(ref(db('anna'), `${E}/results/leaderboard/anna`), full.a))
    await assertFails(set(ref(db('anna'), `${E}/results/gloggOfEvening/vanlig`), { gId: 'g1', avg: 5 }))
  })
})

describe('rättningen', () => {
  // Samma skrivning som showReview() i src/data/quiz.ts
  const review = { 'live/review': { qId: 'q1' }, 'reveal/correct/q1': 'B' }

  it('admin visar en fråga och kopierar rätt svar till reveal/, som gäster får läsa', async () => {
    await assertSucceeds(update(ref(db('admin'), E), review))
    await assertSucceeds(get(ref(db('anna'), `${E}/reveal/correct`)))
  })

  it('gäst får inte avslöja rätt svar själv', async () => {
    await assertFails(update(ref(db('anna'), E), review))
    await assertFails(set(ref(db('anna'), `${E}/reveal/correct/q1`), 'B'))
  })
})

describe('glöggprovningen', () => {
  const state = { serving: 2, next: 3 }

  it('admin serverar per klass och gäster ser det', async () => {
    await assertSucceeds(set(ref(db('admin'), `${E}/live/tasting/vanlig`), state))
    await assertSucceeds(get(ref(db('anna'), `${E}/live/tasting`)))
  })

  it('gäst får inte byta glögg eller läsa andras betyg', async () => {
    await assertFails(set(ref(db('anna'), `${E}/live/tasting/vanlig`), state))
    await assertFails(get(ref(db('anna'), `${E}/ratings`)))
  })
})

describe('förbered kvällen', () => {
  // Samma skrivning som savePreparation() med toPayload() i src/admin/preparation.ts
  const changes = {
    'config/name': 'Glöggkväll',
    'config/gloggs': { g1: { class: 'vanlig', name: 'A', description: '' }, g2: { class: 'vanlig', name: 'B', description: '' } },
    'config/criteria': { c1: { name: 'Smak', order: 1, lowIsGood: false } },
    'config/songs': { s1: { order: 1, spotifyUri: 'spotify:track:2FRnf9qhLbvw8fu4IBXx78', startMs: 30_000, secondsPerQuestion: 30 } },
    'config/questions': {
      q1: { songId: 's1', order: 1, text: 'Årtal?', answerType: 'text', options: { A: '1984', B: '1985', C: '1986', D: '1987' } },
    },
    'secret/numbers': { vanlig: { 1: 'g2', 2: 'g1' }, alkfri: {} },
    'secret/correct': { q1: 'A' },
    'secret/joinCode': 'tomte',
  }

  it('admin sparar glögger, kriterier, nummer och kod i ett anrop', async () => {
    await assertSucceeds(update(ref(db('admin'), E), changes))
  })

  it('gäst får inte spara och inte läsa numren eller facit', async () => {
    await assertFails(update(ref(db('anna'), E), changes))
    await assertFails(get(ref(db('anna'), `${E}/secret/numbers`)))
    await assertFails(get(ref(db('anna'), `${E}/secret/correct`)))
  })

  it('gäst får läsa frågorna, som inte innehåller facit', async () => {
    await assertSucceeds(update(ref(db('admin'), E), changes))
    await assertSucceeds(get(ref(db('anna'), `${E}/config/questions`)))
  })
})

// Hela regelverket enligt docs/spec.md (#23): det som inte redan täcks ovan.
describe('fullständiga regler', () => {
  async function seed(path: string, value: unknown) {
    await env.withSecurityRulesDisabled((ctx) => set(ref(ctx.database(), `${E}/${path}`), value))
  }

  describe('bara admin skriver kvällen', () => {
    const areas = ['config/name', 'secret/joinCode', 'live/stage', 'reveal/correct/q1', 'results/leaderboard/anna', 'assets/i1']

    it.each(areas)('gäst får inte skriva %s', async (path) => {
      await assertFails(set(ref(db('anna'), `${E}/${path}`), 'x'))
    })

    it('ingen inloggning: inga skrivningar alls, inte heller som gäst', async () => {
      for (const path of [...areas, 'guests/okand', 'answers/q1/okand', 'ratings/okand/1/c1', 'guesses/okand']) {
        await assertFails(set(ref(db(), `${E}/${path}`), 'x'))
      }
    })

    it('ingen får skriva /admins, inte ens en admin', async () => {
      await assertFails(set(ref(db('admin'), 'admins/anna'), true))
      await assertFails(set(ref(db('anna'), 'admins/anna'), true))
    })

    it('ett inloggat konto som inte står under /admins är inte admin', async () => {
      await assertFails(set(ref(db('okand'), `${E}/live/stage`), 'done'))
      await assertFails(get(ref(db('okand'), `${E}/secret`)))
    })

    it('gäst får inte läsa reveal/ eller results/ utan att ha gått med', async () => {
      await assertFails(get(ref(db('okand'), `${E}/reveal`)))
      await assertFails(get(ref(db('okand'), `${E}/results`)))
      await assertSucceeds(get(ref(db('anna'), `${E}/results`)))
    })
  })

  describe('guests', () => {
    const base = { name: 'Bertil', class: 'vanlig', joinCode: 'hemlig', joinedAt: serverTimestamp() }

    it('nekar tomt namn, okänd klass, extra fält och tid från klientens klocka', async () => {
      await assertFails(set(ref(db('bertil'), `${E}/guests/bertil`), { ...base, name: '' }))
      await assertFails(set(ref(db('bertil'), `${E}/guests/bertil`), { ...base, class: 'stark' }))
      await assertFails(set(ref(db('bertil'), `${E}/guests/bertil`), { ...base, admin: true }))
      await assertFails(set(ref(db('bertil'), `${E}/guests/bertil`), { ...base, joinedAt: Date.now() }))
      await assertSucceeds(set(ref(db('bertil'), `${E}/guests/bertil`), base))
    })

    it('gäst kan inte byta namn eller ta bort sig själv', async () => {
      await assertFails(set(ref(db('anna'), `${E}/guests/anna/name`), 'Admin'))
      await assertFails(set(ref(db('anna'), `${E}/guests/anna`), null))
    })
  })

  describe('answers', () => {
    it('nekar svar från någon som inte har gått med', async () => {
      await assertFails(set(ref(db('okand'), `${E}/answers/q1/okand`), { choice: 'A', at: serverTimestamp() }))
    })

    it('nekar extra fält och svar utanför quizfasen', async () => {
      await assertFails(set(ref(db('anna'), `${E}/answers/q1/anna`), { choice: 'A', at: serverTimestamp(), stars: 3 }))
      await setLive({ stage: 'evening', quiz: { state: 'closed', songId: 's1', qId: 'q1', openedAt: Date.now(), durationMs: 60_000 } })
      await assertFails(set(ref(db('anna'), `${E}/answers/q1/anna`), { choice: 'A', at: serverTimestamp() }))
    })
  })

  describe('ratings', () => {
    beforeEach(async () => {
      await setLive({
        stage: 'evening',
        tasting: { vanlig: { open: true, serving: 1, next: null }, alkfri: { open: true, serving: 1, next: null } },
      })
    })

    it('nekar decimaltal och nummer som inte finns i gästens klass', async () => {
      await assertFails(set(ref(db('anna'), `${E}/ratings/anna/1/c1`), 3.5))
      await seed('guests/cecilia', { name: 'Cecilia', class: 'alkfri', joinCode: 'hemlig', joinedAt: 1 })
      // Nummer 1 finns bara i vanlig.
      await assertFails(set(ref(db('cecilia'), `${E}/ratings/cecilia/1/c1`), 4))
    })

    it('nekar betyg från någon som inte har gått med', async () => {
      await assertFails(set(ref(db('okand'), `${E}/ratings/okand/1/c1`), 4))
    })
  })

  describe('guesses', () => {
    beforeEach(async () => {
      await setLive({ stage: 'wrapup', wrapup: { step: 'guess' } })
      await seed('config/gloggs/g2', { class: 'alkfri', name: 'Äpple', description: '' })
    })

    it('nekar glögger från den andra klassen och nummer som inte finns i klassen', async () => {
      const guesses = ref(db('anna'), `${E}/guesses/anna`)
      await assertFails(set(guesses, { map: { 1: 'g2' }, locked: false }))
      await assertFails(set(guesses, { map: { 7: 'g1' }, locked: false }))
      await assertSucceeds(set(guesses, { map: { 1: 'g1' }, locked: false }))
    })

    it('nekar extra fält och gissningar från någon som inte har gått med', async () => {
      await assertFails(set(ref(db('anna'), `${E}/guesses/anna`), { map: { 1: 'g1' }, locked: false, score: 6 }))
      await assertFails(set(ref(db('okand'), `${E}/guesses/okand`), { map: {}, locked: false }))
    })

    it('en låst gissning kan inte tas bort', async () => {
      await assertSucceeds(set(ref(db('anna'), `${E}/guesses/anna`), { map: { 1: 'g1' }, locked: true }))
      await assertFails(set(ref(db('anna'), `${E}/guesses/anna`), null))
    })
  })
})

describe('tre oberoende lägen', () => {
  const answer = () => set(ref(db('anna'), `${E}/answers/q1/anna`), { choice: 'A', at: serverTimestamp() })
  const rate = () => set(ref(db('anna'), `${E}/ratings/anna/1/c1`), 4)

  it('Pausa låten och Hoppa över låten (idle med qId) godkänns utan tider, och tar inte emot svar', async () => {
    await assertSucceeds(set(ref(db('admin'), `${E}/live/quiz`), { state: 'idle', qId: 'q1' }))
    await assertFails(answer())
  })

  it('nekar svar medan låten spelar men frågan inte visats', async () => {
    await setLive({ stage: 'evening', quiz: { state: 'playing', songId: 's1', qId: 'q1' } })
    await assertFails(answer())
  })

  it('godkänner rankning medan en fråga är öppen, och svar samtidigt', async () => {
    await setLive({
      stage: 'evening',
      tasting: { vanlig: { open: true, serving: 1, next: null } },
      quiz: { state: 'open', songId: 's1', qId: 'q1', openedAt: Date.now(), durationMs: 60_000 },
    })
    await assertSucceeds(rate())
    await assertSucceeds(answer())
  })

  it('rankningen följer gästens egen klass', async () => {
    await setLive({
      stage: 'evening',
      tasting: { vanlig: { open: false, serving: 1, next: null }, alkfri: { open: true, serving: 1, next: null } },
    })
    await assertFails(rate())
  })

  it.each(['lobby', 'evening', 'wrapup', 'done'] as const)('lägesknappen %s (stageChanges) godkänns', async (stage) => {
    const live = { stage: 'evening' as const, quiz: { state: 'open' as const, qId: 'q1', openedAt: Date.now(), durationMs: 60_000 } }
    await assertSucceeds(update(ref(db('admin'), E), stageChanges(stage, live)))
  })

  it.each(['review', 'guess', 'reveal', 'done'] as const)('stegfliken %s (wrapupStepChanges) godkänns', async (step) => {
    await assertSucceeds(update(ref(db('admin'), E), wrapupStepChanges(step)))
  })

  it('gissningen kräver steget guess, inte bara att kvällen är i avslutningen', async () => {
    await setLive({ stage: 'wrapup', wrapup: { step: 'review' } })
    await assertFails(set(ref(db('anna'), `${E}/guesses/anna`), { map: { 1: 'g1' }, locked: false }))
  })
})

describe('nollställ kvällen', () => {
  it('admin tar bort kvällens resultat i ett anrop, och förberedelserna finns kvar', async () => {
    await env.withSecurityRulesDisabled((ctx) =>
      update(ref(ctx.database(), E), {
        'ratings/anna': { 1: { c1: 4 } },
        'answers/q1/anna': { choice: 'A', at: 1 },
        'results/leaderboard/anna': { points: 1, stars: 3, rank: 1, name: 'Anna' },
        'secret/quizTimes/q1': { openedAt: 1, durationMs: 20_000 },
      }),
    )
    await assertSucceeds(update(ref(db('admin'), E), resetChanges(false)))
    const after = await read(E)
    expect(after.ratings).toBeUndefined()
    expect(after.answers).toBeUndefined()
    expect(after.results).toBeUndefined()
    expect(after.live).toBeUndefined()
    expect(after.secret.quizTimes).toBeUndefined()
    expect(after.secret.joinCode).toBe('hemlig')
    expect(after.secret.correct).toEqual({ q1: 'B' })
    expect(after.config.name).toBe('Test')
    expect(after.guests.anna).toBeDefined()
  })

  it('med gästerna tas även guests/ bort', async () => {
    await assertSucceeds(update(ref(db('admin'), E), resetChanges(true)))
    expect((await read(E)).guests).toBeUndefined()
  })

  it('gäster får inte nollställa kvällen', async () => {
    await assertFails(update(ref(db('anna'), E), resetChanges(false)))
  })
})
