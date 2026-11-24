// Fyller Firebase Emulator Suite med ett testevent och ett admin-konto,
// så att appen går att prova lokalt. Rör aldrig det riktiga projektet.
//
//   Admin:  admin@julmingel.test / julmingel   (bara i emulatorn)
//   Gäst:   http://127.0.0.1:5173/julmingel/#/?e=demo&k=glogg

// Standardinstansen, som database.rules.json gäller för.
const NAMESPACE = 'demo-glogg-mingel-default-rtdb'
const AUTH = 'http://127.0.0.1:9099'
const DB = 'http://127.0.0.1:9000'
const ADMIN = { email: 'admin@julmingel.test', password: 'julmingel' }
const EVENT_ID = 'demo'

async function waitFor(url, label) {
  for (let i = 0; i < 120; i++) {
    try {
      await fetch(url)
      return
    } catch {
      await new Promise((resolve) => setTimeout(resolve, 1000))
    }
  }
  throw new Error(`${label} svarar inte på ${url}`)
}

async function identity(method) {
  const res = await fetch(`${AUTH}/identitytoolkit.googleapis.com/v1/accounts:${method}?key=demo-api-key`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ...ADMIN, returnSecureToken: true }),
  })
  return { ok: res.ok, body: await res.json() }
}

async function adminUid() {
  const signUp = await identity('signUp')
  if (signUp.ok) return signUp.body.localId
  const signIn = await identity('signInWithPassword')
  if (signIn.ok) return signIn.body.localId
  throw new Error(`Kunde inte skapa admin-kontot: ${JSON.stringify(signUp.body)}`)
}

async function put(path, value) {
  const res = await fetch(`${DB}/${path}.json?ns=${NAMESPACE}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', Authorization: 'Bearer owner' },
    body: JSON.stringify(value),
  })
  if (!res.ok) throw new Error(`Kunde inte skriva ${path}: ${res.status} ${await res.text()}`)
}

const demoEvent = {
  config: {
    name: 'Glöggmingel (test)',
    joinOpen: true,
    criteria: {
      c1: { name: 'Smak', order: 1, lowIsGood: false },
      c2: { name: 'Doft', order: 2, lowIsGood: false },
      c3: { name: 'Sötma', order: 3, lowIsGood: true },
    },
    gloggs: {
      g1: { class: 'vanlig', name: 'Klassisk rödvinsglögg', description: 'Kanel, nejlika och apelsin.' },
      g2: { class: 'vanlig', name: 'Vit glögg', description: 'Vitt vin, kardemumma och ingefära.' },
      g3: { class: 'vanlig', name: 'Starkvinsglögg', description: 'Portvin och russin.' },
      g4: { class: 'alkfri', name: 'Svartvinbärsglögg', description: 'Alkoholfri, med svartvinbär.' },
      g5: { class: 'alkfri', name: 'Äppelglögg', description: 'Alkoholfri, med äpple och kanel.' },
    },
  },
  secret: {
    joinCode: 'glogg',
    numbers: {
      vanlig: { 1: 'g2', 2: 'g1', 3: 'g3' },
      alkfri: { 1: 'g5', 2: 'g4' },
    },
  },
  live: {
    phase: 'registration',
    nowText: 'Välkommen! Glöggprovningen börjar snart.',
  },
}

await waitFor(AUTH, 'Auth-emulatorn')
await waitFor(DB, 'Databasemulatorn')
const uid = await adminUid()
await put(`admins/${uid}`, true)
await put(`events/${EVENT_ID}`, demoEvent)

console.log(`Emulatorn är fylld med testdata.
  Admin: ${ADMIN.email} / ${ADMIN.password}
  Gäst:  http://127.0.0.1:5173/julmingel/#/?e=${EVENT_ID}&k=${demoEvent.secret.joinCode}
  Appens databas i översikten: http://127.0.0.1:4000/database/${NAMESPACE}/data`)
