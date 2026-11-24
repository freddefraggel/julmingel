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

- `npm run dev`: Vite på http://127.0.0.1:5173/julmingel/ (kopplas mot Firebase Emulator Suite i #4)
  - `#/design` visar grundkomponenterna, bara i utvecklingsläge
- `npm test`: Vitest (routing, kodstruktur; poängräkning och regeltester tillkommer i #18 och #23)
- `npm run build`: typkontroll (`tsc -b`) och Vite-bygge till `dist/`

## Kräver Fredrik (kan inte göras från koden)

Spotify-appen på developer.spotify.com (Premium), Firebase-projektet `glogg-mingel` och admin-`uid` under `/admins`, samt Pages-källan "GitHub Actions" i repots inställningar.
