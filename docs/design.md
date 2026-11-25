# Design

Källa: [Designcanvas](https://claude.ai/artifact/9RMonfT3HJ84ksjJFVr3PB). En kopia av varje skärm ligger i [`design/`](design/) som `.dc.html`. Filerna är referens för layout, text och färger, inte kod att bygga vidare på. Markupen använder canvasens egna format (`<x-dc>`, `{{hål}}`, `<sc-for>`), så den ska översättas till React-komponenter.

## Färger

| Roll | Hex |
| --- | --- |
| Bakgrund (vinröd) | `#2B1015` |
| Ytor, kort | `#3D1A20`, `#4A222A`, `#5A2C34` |
| Text (ljus) | `#F7ECDC` |
| Dämpad text | `#D9C3AE`, `#B89C88`, `#7A4A50` |
| Accent (guld) | `#E8B04B`, ljusare `#F3C873` |
| Rosé | `#D98A7E` |
| Rätt / positivt (grön) | `#8FBF9A`, mörk `#1F3A28` |
| Fel / varning (röd) | `#C4454F` |

## Typsnitt

- Rubriker: **Fraunces** (serif)
- Brödtext och knappar: **Nunito** (sans-serif)

Båda via `@fontsource`, inga externa fontanrop.

## Skärmar

Gästens mobil, 390×844:

| Fil | Skärm | Issue |
| --- | --- | --- |
| `Main.dc.html` | 1. Registrera: namn, Vanlig/Alkoholfri, Gå med | #6 |
| `HemStart.dc.html` | 2a. Hem innan start: välkomst och ”Ikväll” i tre steg | #59 |
| `Hem.dc.html` | 2. Hem under kvällen: ett glöggkort (Ranka nr X, Se kvällens glögger), quizrad, ”Ny quizfråga!” när en fråga är öppen | #59, #58 |
| `Ranka.dc.html` | 3. Ranka glögg: välj nummer, 1–5 per kriterium | #13 |
| `Glogger.dc.html` | 3b. Kvällens glögger: i hemlig ordning | #14 |
| `Gissa.dc.html` | 4. Gissa glöggen: nummer → glögg, Lås mina gissningar | #21 |
| `QuizLyssna.dc.html` | 5a. Låten spelas: ”Lyssna noga … Frågan kommer strax.”, ingen timer | #56 |
| `QuizFraga.dc.html` | 5. Quizfråga: textsvar, glöggkopp-timer, stjärnor, ”Till provningen” | #16, #58 |
| `QuizBild.dc.html` | 5b. Quizfråga med bildsvar | #16 |
| `QuizSvar.dc.html` | 6. Tiden är ute: låst svar, tillbaka till provningen efter några sekunder | #16, #58 |
| `RattningGast.dc.html` | 7a. Rättning: rätt svar, eget svar, poäng hittills | #19 |
| `TopplistaAvslojas.dc.html` | 7b. Topplistan avslöjas | #20 |
| `Topplista.dc.html` | 7c. Topplista med Kvällens glögg och Dina gissningar | #20, #21 |
| `HemPokal.dc.html` | 8. Hem efter kvällen, med pokal | #22 |

Admin-enheten, 1280×800:

| Fil | Skärm | Issue |
| --- | --- | --- |
| `AdminKontroll.dc.html` | Styr kvällen: tre lägen överst, kolumnerna Glöggprovning och Musikquiz parallellt (Spela låt → Visa fråga) | #57, #56 |
| `QRSkarm.dc.html` | Välkomstskärm med QR för surfplatta, 1280×800 | #60 |
| `QRA4.dc.html` | Välkomstaffisch A4 för utskrift, 794×1123, ljus bakgrund | #60 |
| `AdminKonfig.dc.html` | Förbered kvällen: glögger, kriterier, låtar, frågor, Spela på + Uppdatera enheter | #9, #10, #11, #61 |
| `AdminGlogg.dc.html` | Glöggprovning, detaljvy: serveras nu, nästa, hela ordningen | #12 |
| `AdminRattning.dc.html` | Rättningsläge | #19 |
| `AdminTopplista.dc.html` | Avslöja topplistan | #20 |
