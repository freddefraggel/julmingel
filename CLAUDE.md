# julmingel

Webbapp för ett glöggmingel: gästerna rankar glögg och kör ett musikquiz på mobilen, medan värden styr kvällen från en admin-enhet.

## Läs först

- **Teknisk spec:** [docs/spec.md](docs/spec.md). Den är spikad, så följ den. Vill du avvika, ta upp det i PR:en.
- **Design:** [docs/design.md](docs/design.md), med skärmar som referens i `docs/design/`.
- **Arbetet** är uppdelat i GitHub-issues med milstolpar 1–8 (byggplanen). Gör ett issue per PR och skriv `Closes #N`.

## Stack

Vite + React + TypeScript, Firebase Realtime Database + Auth (Spark), GitHub Pages via Actions, Spotify Web API (PKCE) från admin-enheten. Ingen egen server.

## Regler att inte bryta

- Sajten ligger på `https://freddefraggel.github.io/julmingel/`, så Vite `base` är `'/julmingel/'`. Specen skriver `/glogg/`, men `/julmingel/` gäller.
- Använd `HashRouter`: `#/` för gäst, `#/admin` och `#/admin/forbered` för admin.
- Bara `src/data/` får importera Firebase. Övrigt: `src/guest/`, `src/admin/`, `src/scoring.ts`, `src/spotify.ts`, `src/types.ts`.
- Färger, typsnitt och rundning finns som CSS-variabler i `src/styles/tokens.css`. Använd dem i stället för hårdkodade hex-värden. Grundkomponenterna (knapp, kort, chip, flikar, stjärnor, glöggkopp-timer) ligger i `src/ui/`.
- Facit (`secret/correct`, `secret/numbers`, topp 4 före avslöjandet) får aldrig hamna där gäster kan läsa det.
- Tid kommer från servern: `ServerValue.TIMESTAMP` och `.info/serverTimeOffset`, aldrig klientens klocka för poäng eller stjärnor.
- Repot är publikt. Inga hemligheter i koden: admin-lösenord och `joinCode` sätts i Firebase. Firebase-konfigurationen får vara publik.
- UI-texter skrivs på svenska.

## Kommandon

Kräver Node och Java 21 (för Firebase Emulator Suite).

- `npm run dev`: startar Firebase-emulatorerna (Auth och Realtime Database), fyller dem med ett testevent och startar Vite på http://127.0.0.1:5173/julmingel/
  - Testevent `demo` med koden `glogg`. Admin i emulatorn: `admin@julmingel.test` / `julmingel`
  - Emulatorns översikt: http://127.0.0.1:4000/
  - `#/design` visar grundkomponenterna, bara i utvecklingsläge
  - `VITE_FIREBASE_EMULATOR=false` kör mot det riktiga projektet i stället
- `npm test`: Vitest (routing, komponenter, kodstruktur; poängräkning tillkommer i #18)
- `npm run test:rules`: databasreglerna testas mot emulatorn (`tests/rules/`)
- `npm run build`: typkontroll (`tsc -b`) och Vite-bygge till `dist/`
- `npm run deploy:rules`: `firebase deploy --only database` till projektet i `.firebaserc`

**Deploy:** varje push till `main` byggs och publiceras på GitHub Pages av `.github/workflows/deploy.yml` (`npm ci`, `npm test`, `npm run build`). Firebase-webbkonfigurationen kommer in som `VITE_FIREBASE_*` i bygget, från repo-variablerna `FIREBASE_API_KEY`, `FIREBASE_AUTH_DOMAIN`, `FIREBASE_DATABASE_URL`, `FIREBASE_PROJECT_ID` och `FIREBASE_APP_ID` (Settings → Secrets and variables → Actions → Variables). Lokalt används `.env.local`, se `.env.example`.

Emulatorn kör projektet `demo-glogg-mingel`. Reglerna gäller bara standardinstansen `demo-glogg-mingel-default-rtdb`, så appen och testdatan använder den.

## Parallella sessioner

Flera Claude-sessioner kan jobba samtidigt, en per issue, var och en i en egen worktree under `.claude/worktrees/`.

- **Ny worktree:** kör `npm ci` först, eftersom `node_modules` inte följer med. `.env.local` kopieras dit via `.worktreeinclude`.
- **Gren:** utgå från `origin/main`, en gren per issue (`feat/<nr>-<kort-namn>`).
- **Före PR:** `git fetch` och `git rebase origin/main`, sedan `npm test` och `npm run build`. Andra sessioner mergar under tiden.
- **Delade filer** krockar lätt: `src/types.ts`, `src/data/index.ts`, routerna i `src/App.tsx` och databasreglerna. Ändra bara det issuet behöver och lägg nya saker i slutet i stället för att flytta om.
- **Aldrig:** pusha till `main`, force-pusha, merga PR:er eller deploya databasregler. Det gör Fredrik.
- Tillåtna kommandon utan fråga finns i `.claude/settings.json`. Personliga tillägg går i `.claude/settings.local.json` (ignoreras av git).

## Kräver Fredrik (kan inte göras från koden)

Spotify-appen på developer.spotify.com (Premium), Firebase-projektet `glogg-mingel` och admin-`uid` under `/admins`, Pages-källan "GitHub Actions" i repots inställningar, samt repo-variablerna `FIREBASE_*` med webbkonfigurationen.
