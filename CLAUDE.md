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
- Facit (`secret/correct`, `secret/numbers`, topp 4 före avslöjandet) får aldrig hamna där gäster kan läsa det.
- Tid kommer från servern: `ServerValue.TIMESTAMP` och `.info/serverTimeOffset`, aldrig klientens klocka för poäng eller stjärnor.
- Repot är publikt. Inga hemligheter i koden: admin-lösenord och `joinCode` sätts i Firebase. Firebase-konfigurationen får vara publik.
- UI-texter skrivs på svenska.

## Kommandon

Fyll i när #2 och #4 är klara:

- `npm run dev`: Vite mot Firebase Emulator Suite
- `npm test`: Vitest (poängräkning) och regeltester
- `npm run build`

## Kräver Fredrik (kan inte göras från koden)

Spotify-appen på developer.spotify.com (Premium), Firebase-projektet `glogg-mingel` och admin-`uid` under `/admins`, samt Pages-källan "GitHub Actions" i repots inställningar.
