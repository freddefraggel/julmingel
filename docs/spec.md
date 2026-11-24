# Glöggmingel – teknisk systemspecifikation

> **Avvikelse från originalet:** repot heter `julmingel`, så sajten ligger på `https://freddefraggel.github.io/julmingel/`. Överallt där specen nedan säger `/glogg/` gäller `/julmingel/` (Vite `base`, QR-länk, Spotify redirect-URI).

**Status:** Spikad 2026-11-24 · Fredrik Hedberg
**Levande version:** https://claude.ai/artifact/MKN29w97mrS49UYqoebuZp
**Underlag:** [Kravspec](https://claude.ai/artifact/F2woPSBydp32gg4UvoTQor) · [Designcanvas](https://claude.ai/artifact/9RMonfT3HJ84ksjJFVr3PB) · sammanfattning av designen i [design.md](design.md)

## Sammanfattning och hostingbeslut

**Beslut: GitHub Pages för webbappen + Firebase (Realtime Database och Authentication, gratisplanen Spark) för realtid och data.** Ingen egen serverkod behövs, och allt ryms gratis för en kväll med ~30 gäster. Azure blir plan B.

GitHub Pages räcker inte ensamt. Pages serverar bara statiska filer, men kravspecen kräver tre saker som behöver en backend:

- **Delat tillstånd** – alla mobiler ska se samma fas, fråga och glögg.
- **Realtid** – admin trycker, mobilerna följer direkt.
- **Tid på servern** – svarstid och stjärnor får inte gå att fuska med genom att ändra mobilens klocka eller ladda om.

Firebase Realtime Database löser alla tre utan serverkod: klienterna prenumererar på data, `ServerValue.TIMESTAMP` sätts av Firebase, och säkerhetsreglerna kan jämföra mot serverns klocka (`now`). Det gör att anti-fusk-reglerna kan ligga i databasreglerna i stället för i en API-tjänst.

| Alternativ | Serverkod | Realtid | Servertid | Kostnad | Byggtid |
| --- | --- | --- | --- | --- | --- |
| **A. GitHub Pages + Firebase** (valt) | Ingen | Inbyggd | `ServerValue.TIMESTAMP` + regler med `now` | 0 kr | Kortast |
| B. Azure Static Web Apps + Functions + Web PubSub, i Alla Lirar-prenumerationen | API i Functions | Web PubSub (gratisnivå 20 anslutningar) eller SignalR | Functions sätter tiden | Några kronor (Web PubSub Standard behövs för fler än 20 gäster) | +1–2 kvällar |
| C. GitHub Pages + Supabase | Ingen | Realtime-kanaler | `now()` i Postgres, RLS-policyer | 0 kr | Som A, mer SQL |

**När väljer vi Azure i stället?** Om vi inte vill ha ytterligare en molntjänst, eller vill återanvända Alla Lirar-infrastrukturen. Frontenden är densamma i båda fallen; bara datalagret (`src/data/`) byts. Se Azure-varianten under Risker.

## Arkitektur och teknikval

En enda statisk webbapp med två vyer – gäst och admin – som pratar direkt med Firebase. Ingen egen server finns.

```
                    GitHub Pages (statisk React-app)
                     │ laddar appen          │
                     ▼                       ▼
  Gästernas mobiler ◄──realtid──► Firebase ◄──realtid──► Admin-enhet
  läser live/, config/          RTDB (regler +           skriver live/, results/
  skriver egna svar, betyg      servertid) + Auth        ensam om att läsa secret/
                                                               │ styr uppspelning
                                                               ▼
                                                        Spotify Web API (PKCE)
                                                               │ Spotify Connect
                                                               ▼
                                                        Spotify-appen / högtalare
```

Mobiler och admin-enhet läser och skriver mot samma databas; bara admin-enheten pratar med Spotify.

| Del | Val | Varför |
| --- | --- | --- |
| Ramverk | Vite + React + TypeScript | Snabb utvecklingsloop, liten statisk build |
| Styling | Vanlig CSS med variabler från designcanvasen (#2B1015, #E8B04B, #D98A7E); Fraunces och Nunito via `@fontsource` | Inga externa fontanrop, matchar designen |
| Data och realtid | Firebase JS SDK (modulär): `firebase/database`, `firebase/auth` | Realtid, servertid och behörighet utan server |
| Routing | `HashRouter`: `#/` gäst, `#/admin` kontrollpanel, `#/admin/forbered` konfiguration | Fungerar på GitHub Pages utan omskrivningar |
| QR-kod | `qrcode` (npm), ritas på admin-skärmen | Liten, inga nätverksanrop |
| Test | Vitest för poängräkning, `@firebase/rules-unit-testing` för regler | De två ställen där fel syns först på kvällen |

**Kodstruktur.** `src/guest/` och `src/admin/` för vyerna, `src/data/` som enda ställe som pratar med Firebase (gör Azure-bytet möjligt), `src/scoring.ts` för alla beräkningar och `src/spotify.ts` för uppspelning. Delade typer i `src/types.ts`.

## Datamodell i Realtime Database

Allt för en kväll ligger under `/events/{eventId}` och är uppdelat efter vem som får läsa och skriva. Det som avslöjar svaren – rätt svar och vilken glögg som har vilket nummer – ligger i `secret/` och kopieras till `reveal/` först när admin avslöjar det. Annars kan en gäst läsa facit i nätverkstrafiken.

```
/admins/{uid}: true                      ← sätts manuellt i Firebase-konsolen
/events/{eventId}/
  config/                                ← admin skriver, gäster läser
    name, joinOpen
    criteria/{cId}: { name, order, lowIsGood }
    gloggs/{gId}: { class: "vanlig"|"alkfri", name, description, imageId }
    songs/{sId}: { order, spotifyUri, startMs, secondsPerQuestion }
    questions/{qId}: { songId, order, text, answerType: "text"|"image",
                       options: { A, B, C, D } }   ← text eller imageId
  assets/{imageId}: "data:image/webp;base64,…"   ← se Bilder
  secret/                                ← bara admin
    joinCode                             ← kvällens lösenord, ligger i QR-koden
    correct/{qId}: "A"|"B"|"C"|"D"
    numbers/{class}/{number}: gId       ← serveringsordningen
    quizTimes/{qId}: { openedAt, durationMs }   ← skrivs med live/quiz, för stjärnorna
    leaderboard                          ← hela topplistan före avslöjandet
  live/                                  ← admin skriver, alla läser
    phase: "registration"|"tasting"|"quiz"|"review"|"guess"|"reveal"|"done"
    nowText                              ← ”Just nu: …”
    tasting/{class}: { serving, next }
    quiz: { qId, openedAt, durationMs }  ← openedAt = ServerValue.TIMESTAMP
    review: { qId }
    reveal: { step: 0–4 }
    answered: { qId, count, total }      ← ”Har svarat x av y”; gäster får inte läsa andras svar
  reveal/                                ← admin kopierar hit vid avslöjande
    correct/{qId}, numbers/{class}/{number}
  guests/{uid}: { name, class, joinCode, joinedAt }
  ratings/{uid}/{number}/{cId}: 1–5     ← numret inom gästens klass
  answers/{qId}/{uid}: { choice, at }    ← at = ServerValue.TIMESTAMP
  guesses/{uid}: { map: { number: gId }, locked }
  results/                               ← admin beräknar och skriver
    leaderboard/{uid}: { points, stars, rank, name }   ← name: gäster får inte läsa guests/
    gloggOfEvening/{class}: { gId, avg }
```

**Glöggerna utan nummer.** `config/gloggs` saknar nummer, så *Kvällens glögger* kan visa bild och namn i blandad ordning (sorteras på gId, som är slumpmässigt). Ranking och gissning görs på nummer, och kopplingen nummer → glögg finns bara i `secret/` tills avslöjandet.

**Gäst-id.** Varje gäst loggas in med Firebase Anonymous Auth. `uid` sparas av SDK:n i mobilens IndexedDB, så en omladdning ger samma gäst – det är sessionen kravspecen ber om. Byter gästen webbläsare blir det en ny användare; admin kan då ta bort dubbletten.

**Klassbyte.** Admin skriver `guests/{uid}/class`. Eventuella betyg ligger kvar under gamla numren och räknas inte i den nya klassen (tas bort vid bytet).

## Realtid, tid och poängräkning

Admin-enheten är den enda som skriver till `live/`; alla mobiler prenumererar på den med `onValue` och renderar den fas som står där. Ingen mobil styr sitt eget flöde, så en omladdad mobil hamnar alltid rätt.

**Fasbyten.** Varje knapp hos admin är en enda skrivning, t.ex. `live/phase = "quiz"` eller `live/tasting/vanlig/serving = 3`. Firebase skickar ändringen till alla anslutna klienter på under en sekund. Tappar en mobil nätet återansluter SDK:n själv och hämtar senaste läget.

**Nästa fråga.** Admin skriver i ett anrop `live/quiz = { qId, openedAt: ServerValue.TIMESTAMP, durationMs }` och samma tider till `secret/quizTimes/{qId}`. Starttiden sätts alltså av Firebase, inte av admin-enhetens klocka. `live/quiz` skrivs över av nästa fråga, så det är `secret/quizTimes` som stjärnorna räknas från. Reglerna nekar `live/quiz` om tiderna inte stämmer med `secret/quizTimes`.

**Nedräkning på mobilen.** Mobilen läser `.info/serverTimeOffset` och räknar ned mot `openedAt + durationMs` i serverns tid. Glöggkoppen och sekunderna är bara visning; att ladda om sidan ändrar inte sluttiden.

**Svar.** Mobilen skriver `answers/{qId}/{uid} = { choice, at: ServerValue.TIMESTAMP }` vid varje byte. Databasreglerna godkänner bara skrivningen om frågan är den öppna och `now` är före sluttiden (se Säkerhet). Efter sluttiden avvisas alla skrivningar, så senast sparade svar och dess tidpunkt gäller – precis som kravspecens regel om att stjärnorna räknas från senaste bytet.

**Stjärnor.** Räknas från serverns tidsstämplar, bara för rätt svar:

kvar = (openedAt + durationMs − at) / durationMs

| kvar | Stjärnor |
| --- | --- |
| > 0,75 | 3 |
| > 0,50 och ≤ 0,75 | 2 |
| > 0,25 och ≤ 0,50 | 1 |
| ≤ 0,25 | 0 |

**Poäng och topplista.** 1 poäng per rätt svar. Admin-enheten räknar när rättningen börjar, eftersom den är den enda som kan läsa `secret/correct`, och skriver `results/leaderboard`. Sortering: poäng, sedan stjärnor, sedan namn. Lika poäng och lika stjärnor ger delad placering. Beräkningen är en ren funktion (`score(answers, correct, quizConfig, guests)`, där `quizConfig` är `secret/quizTimes`) som enhetstestas.

**Avslöjandet.** `live/reveal/step` går 0 → 4. Vid steg 0 skriver admin bara plats 5 och nedåt till `results/leaderboard`; vid steg 1–4 läggs 4:an, 3:an, 2:an och vinnaren till, en rad per steg. Topp 4 finns alltså inte i databasen innan de avslöjas – inte ens i nätverkstrafiken – vilket uppfyller ”ingen hint i förväg”. Hela listan hålls i admin-enhetens minne och i `secret/leaderboard`.

**Kvällens glögg.** Per klass: snittet av alla betyg på alla kriterier, där kriterier med `lowIsGood` räknas som 6 − värdet. Högst snitt vinner. Admin räknar och skriver `results/gloggOfEvening`.

**Gissa glöggen.** När admin kopierat `secret/numbers` till `reveal/numbers` räknar varje mobil själv ”Du gissade 4 av 6 rätt”. Inget sparas centralt, eftersom gissningen inte är en tävling.

**Pokaler.** Pokalen på startsidan läses från `results/leaderboard/{uid}/rank` och ligger kvar så länge eventet finns i databasen.

## Säkerhet och behörigheter

All behörighet ligger i Firebase-databasreglerna; Firebase-konfigurationen i klientkoden är publik och det är i sin ordning. Två lösenord skyddar kvällen, som kravspecen beslutat:

| Roll | Inloggning | Får |
| --- | --- | --- |
| Admin | Firebase Email/Password-konto, `uid` listat i `/admins` | Läsa och skriva allt i eventet |
| Gäst | Anonymous Auth + kvällens `joinCode` (i QR-länken) | Läsa `config`, `assets`, `live`, `reveal`, `results`; skriva bara sina egna noder, och bara i rätt fas |
| Okänd | – | Ingenting |

QR-koden pekar på `https://<användare>.github.io/glogg/#/?e=<eventId>&k=<joinCode>`. Gästen skriver `joinCode` i sin `guests/{uid}`-post, och regeln jämför med `secret/joinCode`, som gästen själv inte kan läsa. Den som saknar koden kommer inte in.

Utdrag ur reglerna (fullständig fil: `database.rules.json` i repot):

```json
{
  "rules": {
    "admins": { ".read": false, ".write": false },
    "events": {
      "$e": {
        ".read": "root.child('admins/' + auth.uid).exists()",
        ".write": "root.child('admins/' + auth.uid).exists()",
        "config":  { ".read": "data.parent().child('guests/' + auth.uid).exists()" },
        "live":    { ".read": "data.parent().child('guests/' + auth.uid).exists()" },
        "guests": {
          "$uid": {
            ".write": "auth.uid === $uid && !data.exists() && root.child('events/' + $e + '/config/joinOpen').val() === true",
            ".validate": "newData.child('joinCode').val() === root.child('events/' + $e + '/secret/joinCode').val() && newData.child('name').isString() && newData.child('name').val().length <= 30"
          }
        },
        "answers": {
          "$q": {
            "$uid": {
              ".write": "auth.uid === $uid && root.child('events/' + $e + '/live/phase').val() === 'quiz' && root.child('events/' + $e + '/live/quiz/qId').val() === $q && now <= root.child('events/' + $e + '/live/quiz/openedAt').val() + root.child('events/' + $e + '/live/quiz/durationMs').val()",
              ".validate": "newData.child('at').val() === now && newData.child('choice').val().matches(/^[ABCD]$/)"
            }
          }
        }
      }
    }
  }
}
```

Samma mönster gäller `ratings` (bara i fas `tasting`, värde 1–5, numret finns i gästens klass) och `guesses` (bara i fas `guess`, bara om `locked` inte redan är sant, och bara glögger och nummer i gästens klass). Reglerna testas med Firebase Emulator Suite och `@firebase/rules-unit-testing` innan kvällen: en gäst utan kod, ett svar efter sluttiden, ett svar på fel fråga och en läsning av `secret/` ska alla nekas.

**Missbruk.** Anonymous Auth kan i teorin användas för att skapa många konton, men utan `joinCode` går det inte att skriva något. Admin stänger registreringen (`config/joinOpen = false`) när alla är inne. Firebase App Check med reCAPTCHA är ett tillval som inte behövs för en privat fest.

## Spotify-integration

Admin-enheten styr Spotify direkt från webbläsaren med Spotify Web API; ingen server behövs, så det fungerar på GitHub Pages. Musiken spelas i Spotify-appen på admin-enheten eller i en ansluten högtalare (Spotify Connect).

- **Inloggning:** Authorization Code med PKCE, som är gjort för appar utan server och saknar client secret. Redirect-URI: `https://<användare>.github.io/glogg/` (plus `http://127.0.0.1:5173/` för utveckling). Token sparas i admin-enhetens `sessionStorage` och förnyas med refresh token.
- **Scopes:** `user-read-playback-state` och `user-modify-playback-state`.
- **Välj enhet:** `GET /v1/me/player/devices` → admin väljer t.ex. ”MacBook” eller ”Vardagsrum” på *Förbered kvällen*.
- **Ny låt:** `PUT /v1/me/player/play?device_id=…` med `{ uris: [spotifyUri], position_ms: startMs }`. Anropas bara när första frågan på en ny låt öppnas; övriga frågor på samma låt rör inte uppspelningen.
- **Spela låten igen** (rättningsläge): samma anrop.
- **Spotify-länkar:** admin klistrar in `https://open.spotify.com/track/<id>`; appen gör om den till `spotify:track:<id>` och spelar inte upp något förrän kvällen.

**Krav från Spotify.** Appen registreras som en Development Mode-app på developer.spotify.com. [Sedan februari 2026](https://developer.spotify.com/blog/2026-02-06-update-on-developer-access-and-platform-security) kräver det att appägaren har Spotify Premium, och appen får högst fem auktoriserade användare. Det räcker: bara admin loggar in mot Spotify; gästerna rör aldrig Spotify.

**Reserv om API:t krånglar.** Spotify har aviserat att Development Mode får färre endpoints. Om uppspelningsanropen inte fungerar visar kontrollpanelen i stället ”Starta låt 2 – *Last Christmas* från 0:45”, och admin startar låten för hand från en färdig spellista i rätt ordning. Quizet fungerar likadant; bara automatiken försvinner. Spotify-anropen ligger i en egen modul (`src/spotify.ts`) så att reserven är en flagga.

## Bilder

Bilder sparas i databasen som komprimerad WebP, inte i Firebase Storage, eftersom Storage numera kräver betalplanen Blaze. En glöggbild eller svarsbild skalas i webbläsaren till max 800 px och ~80 kB och sparas i `assets/{imageId}`.

- **Uppladdning:** fil väljs på *Förbered kvällen* → `<canvas>` → `toDataURL('image/webp', 0.8)`.
- **Länk:** appen försöker hämta bilden och komprimera den på samma sätt. Blockerar sajten hämtningen (CORS) sparas länken som den är, och admin får en varning om att ladda ned och ladda upp bilden i stället.
- **Förladdning:** när gästen går med hämtas alla `assets` en gång (`get`, inte prenumeration) och läggs i minnet. Inget laddar mitt i quizet.
- **Storlek:** 10 glögger + 12 frågor × 4 bildsvar ≈ 60 bilder ≈ 5 MB. 30 gäster ger ~150 MB nedladdning, långt under gratisgränsen.

## Deploy och miljöer

Koden ligger i ett GitHub-repo och publiceras med GitHub Actions till GitHub Pages vid varje push till `main`.

- **Bygg:** Vite → `dist/` → `actions/upload-pages-artifact` + `actions/deploy-pages`. `base: '/glogg/'` i Vite-konfigurationen.
- **Routing:** hash-routing (`#/admin`), eftersom GitHub Pages saknar omskrivning till `index.html` för djuplänkar.
- **Firebase:** ett projekt, `glogg-mingel`. `github.io`-domänen läggs till under Authorized domains. Reglerna deployas med `firebase deploy --only database` från samma repo.
- **Lokalt:** `npm run dev` mot Firebase Emulator Suite, så att testkvällar inte skräpar ned riktig data.
- **Generalrep:** en testkväll med 3–4 mobiler på riktiga Pages-adressen några dagar innan.

## Kostnad

Allt ryms i gratisnivåerna: 0 kr.

| Tjänst | Gratisgräns | Kvällens behov |
| --- | --- | --- |
| GitHub Pages | 100 GB trafik/mån, 1 GB sajt | < 1 MB app |
| Firebase Realtime Database (Spark) | 100 samtidiga anslutningar, 1 GB lagrat, 10 GB nedladdat/mån | ~30 anslutningar, ~10 MB, ~200 MB |
| Firebase Authentication | Anonymous och Email/Password utan kostnad | ~30 konton |
| Spotify | Development Mode | Admins Premium-konto |

## Risker

| Risk | Konsekvens | Åtgärd |
| --- | --- | --- |
| Spotify stänger av uppspelningsanropen i Development Mode | Ingen automatisk uppspelning | Manuell spellista (se Spotify), testas i förväg |
| Dåligt wifi hemma | Mobiler halkar efter | Firebase återansluter själv; svar sparas lokalt och skickas, men nekas efter sluttiden. Ha gästnätets QR-kod uppsatt |
| Gäst byter webbläsare eller rensar data | Ny användare, förlorade betyg | Admin kan slå ihop eller ta bort dubbletter |
| Admin-enheten laddas om mitt i | Inget tappas: allt läge ligger i `live/` | Admin loggar in igen och fortsätter |
| Vi vill inte ha en ny molntjänst | – | Azure-varianten nedan |

**Azure-variant (plan B).** I Alla Lirar-prenumerationen: Azure Static Web Apps (gratisplanen) serverar samma frontend, med inbyggda Azure Functions som API. Realtid via Azure Web PubSub (gratisnivån har 20 samtidiga anslutningar, för lite för 30 gäster – Standard kostar några kronor för en kväll), eller Server-Sent Events från Functions. Data i Table Storage. Functions sätter tiden och kontrollerar svaren i stället för databasregler. Frontenden byts bara i `src/data/`, men API:t är ~10 endpoints extra att bygga och testa.

## Byggplan

Varje steg är en milstolpe i GitHub, med issues under.

1. **Spike, 1 kväll:** Spotify PKCE + `play` med `position_ms` från en GitHub Pages-sida. Avgör om automatisk uppspelning fungerar.
2. **Grund:** Vite + React + TypeScript, designtoken från designcanvasen, Firebase-projekt, Pages-deploy, emulator.
3. **Registrering och startsida:** QR, namn, klassval, session, kontrollpanel med fas och antal gäster.
4. **Förbered kvällen:** formulär för glögger, kriterier, låtar och frågor, bildkomprimering.
5. **Glöggprovning:** servering per klass, ranking, *Kvällens glögger*.
6. **Musikquiz:** nästa fråga, timer mot servertid, svar, live-fördelning, Spotify.
7. **Rättning, gissning och avslöjande:** `score()` med tester, topplista steg för steg, pokaler, Kvällens glögg.
8. **Härdning:** databasregler med tester, generalrep med riktiga mobiler.
