import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
  type RulesTestEnvironment,
} from '@firebase/rules-unit-testing'
import { get, ref, serverTimestamp, set, update } from 'firebase/database'
import { readFileSync } from 'node:fs'
import { afterAll, beforeAll, beforeEach, describe, it } from 'vitest'

const E = 'events/test'
let env: RulesTestEnvironment

beforeAll(async () => {
  env = await initializeTestEnvironment({
    // Eget projekt-id, så att testerna aldrig skriver i samma databas som npm run dev använder.
    projectId: 'demo-julmingel-rules',
    database: { rules: readFileSync('database.rules.json', 'utf8'), host: '127.0.0.1', port: 9000 },
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
          live: { phase: 'quiz', quiz: { qId: 'q1', openedAt: Date.now(), durationMs: 60_000 } },
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
    await setLive({ phase: 'quiz', quiz: { qId: 'q1', openedAt: Date.now() - 120_000, durationMs: 60_000 } })
    await assertFails(answer('q1'))
  })

  it('nekar tidsstämpel från klientens klocka', async () => {
    await assertFails(set(ref(db('anna'), `${E}/answers/q1/anna`), { choice: 'A', at: Date.now() }))
  })

  it('nekar ogiltigt svarsalternativ', async () => {
    await assertFails(answer('q1', 'E'))
  })
})

describe('betyg och gissningar', () => {
  it('godkänner betyg 1–5 under glöggprovningen', async () => {
    await setLive({ phase: 'tasting' })
    await assertSucceeds(set(ref(db('anna'), `${E}/ratings/anna/1/c1`), 4))
  })

  it('nekar betyg utanför fasen, utanför 1–5 och på nummer som inte finns', async () => {
    await assertFails(set(ref(db('anna'), `${E}/ratings/anna/1/c1`), 4))
    await setLive({ phase: 'tasting' })
    await assertFails(set(ref(db('anna'), `${E}/ratings/anna/1/c1`), 6))
    await assertFails(set(ref(db('anna'), `${E}/ratings/anna/9/c1`), 3))
  })

  it('låsta gissningar kan inte ändras', async () => {
    await setLive({ phase: 'guess' })
    const guesses = ref(db('anna'), `${E}/guesses/anna`)
    await assertSucceeds(set(guesses, { map: { 1: 'g1' }, locked: true }))
    await assertFails(update(guesses, { locked: false }))
  })
})

describe('admin styr kvällen', () => {
  it('admin byter fas, Just nu-text och registrering', async () => {
    await assertSucceeds(set(ref(db('admin'), `${E}/live/phase`), 'tasting'))
    await assertSucceeds(set(ref(db('admin'), `${E}/live/nowText`), 'Glögg 1 serveras'))
    await assertSucceeds(set(ref(db('admin'), `${E}/config/joinOpen`), false))
  })

  it('gäst får inte byta fas eller öppna registreringen', async () => {
    await assertFails(set(ref(db('anna'), `${E}/live/phase`), 'reveal'))
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
