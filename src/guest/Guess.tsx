import { useEffect, useState } from 'react'
import { saveGuess, subscribeOwnGuess, subscribeReveal } from '../data'
import type { Phase } from '../live'
import type { EventConfig, EventReveal, GloggNumber, Guess as GuessData, GuestClass } from '../types'
import { Garland } from '../ui'
import { useAsset } from './assets'
import { BackButton } from './BackButton'
import { gloggsInSecretOrder } from './Gloggs'

type Props = {
  eventId: string
  uid: string
  config: EventConfig | null
  guestClass: GuestClass
  phase: Phase | undefined
  onBack: () => void
}

type NumberMap = Record<GloggNumber, string>

/**
 * Nummer → gId utan tomma platser. Realtime Database kan ge tillbaka ett objekt
 * med nycklarna 1, 2, 3 som en lista, med en tom plats på index 0.
 */
export function cleanMap(map: NumberMap | (string | null)[] | null | undefined): NumberMap {
  const result: NumberMap = {}
  for (const [number, gId] of Object.entries(map ?? {})) if (gId) result[number] = gId
  return result
}

/** Hur många nummer gästen gissade rätt på, när glöggordningen är avslöjad. */
export function guessScore(map: NumberMap, revealed: NumberMap): { right: number; total: number } {
  const numbers = Object.keys(revealed)
  return { right: numbers.filter((n) => map[n] === revealed[n]).length, total: numbers.length }
}

/** Väljer en glögg till ett nummer. Varje glögg används en gång, så den flyttas om den redan var vald. */
export function pick(map: NumberMap, number: GloggNumber, gId: string): NumberMap {
  const next: NumberMap = {}
  for (const [n, g] of Object.entries(map)) if (g !== gId) next[n] = g
  next[number] = gId
  return next
}

/** 4. Gissa glöggen: nummer → glögg, Lås mina gissningar, och facit när värden avslöjar ordningen. */
export function Guess({ eventId, uid, config, guestClass, phase, onBack }: Props) {
  const [saved, setSaved] = useState<GuessData | null | undefined>(undefined)
  const [map, setMap] = useState<NumberMap>({})
  const [reveal, setReveal] = useState<EventReveal>({})
  const [open, setOpen] = useState<GloggNumber | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => subscribeReveal(eventId, setReveal), [eventId])
  useEffect(
    () =>
      subscribeOwnGuess(eventId, uid, (guess) => {
        setSaved(guess)
        setMap(cleanMap(guess?.map))
      }),
    [eventId, uid],
  )

  const gloggs = gloggsInSecretOrder(config?.gloggs, guestClass)
  const numbers = gloggs.map((_, i) => String(i + 1))
  const revealed = reveal.numbers?.[guestClass] ? cleanMap(reveal.numbers[guestClass]) : null
  const locked = saved?.locked === true
  const editable = phase === 'guess' && !locked && !revealed
  const complete = numbers.every((n) => map[n])
  const nameOf = (gId: string | undefined) => gloggs.find((g) => g.gId === gId)?.name

  async function store(next: NumberMap, lock: boolean) {
    setError(null)
    try {
      await saveGuess(eventId, uid, { map: next, locked: lock })
    } catch {
      setError(lock ? 'Kunde inte låsa gissningarna. Gissningen kan vara stängd.' : 'Kunde inte spara gissningen.')
    }
  }

  function choose(gId: string) {
    if (!open) return
    const next = pick(map, open, gId)
    setMap(next)
    setOpen(null)
    void store(next, false)
  }

  const score = revealed ? guessScore(map, revealed) : null

  return (
    <main className="page guest-page guess">
      <Garland />
      <BackButton onClick={onBack} />
      <div className="guess__intro">
        {score ? (
          <>
            <span className="chip chip--green guess__badge">Facit</span>
            <h1>
              Du gissade {score.right} av {score.total} rätt
            </h1>
          </>
        ) : (
          <>
            {editable && <span className="chip chip--gold guess__badge">Nu öppet</span>}
            <h1>Vilken glögg är vilken?</h1>
            <p className="muted">
              {editable
                ? 'Tryck på ett nummer och välj glögg. Varje glögg används en gång.'
                : locked
                  ? 'Dina gissningar är låsta.'
                  : 'Gissningen är stängd.'}
            </p>
          </>
        )}
      </div>

      {saved === undefined ? (
        <p className="muted">Hämtar dina gissningar…</p>
      ) : (
        <ol className="guess__rows">
          {numbers.map((n) => {
            const gId = map[n]
            const name = nameOf(gId)
            const right = revealed ? revealed[n] === gId : null
            const content = (
              <>
                <span className="guess-row__number">{n}</span>
                <GuessThumb imageId={gloggs.find((g) => g.gId === gId)?.imageId} visible={!!gId} />
                <span className="guess-row__text">
                  <span className={name ? 'guess-row__name' : 'guess-row__name guess-row__name--empty'}>{name ?? 'Välj glögg'}</span>
                  {right === false && <span className="guess-row__answer">Rätt: {nameOf(revealed![n])}</span>}
                </span>
                {right !== null && (
                  <span className={`guess-row__mark guess-row__mark--${right ? 'right' : 'wrong'}`}>{right ? 'Rätt' : 'Fel'}</span>
                )}
              </>
            )
            return (
              <li key={n}>
                {editable ? (
                  <button
                    type="button"
                    className={`guess-row${gId ? '' : ' guess-row--empty'}`}
                    aria-label={`Nummer ${n}: ${name ?? 'inte vald'}`}
                    onClick={() => setOpen(n)}
                  >
                    {content}
                  </button>
                ) : (
                  <div className={`guess-row${right === true ? ' guess-row--right' : right === false ? ' guess-row--wrong' : ''}`}>
                    {content}
                  </div>
                )}
              </li>
            )
          })}
        </ol>
      )}

      <div className="quiz__spacer" />
      {error && (
        <p role="alert" className="form-error">
          {error}
        </p>
      )}
      {editable && (
        <>
          <button
            type="button"
            className="btn btn--primary btn--large btn--block"
            disabled={!complete}
            onClick={() => void store(map, true)}
          >
            Lås mina gissningar
          </button>
          <p className="guess__hint">
            {complete ? 'Svaret avslöjas av värden när alla har gissat.' : 'Välj en glögg till varje nummer först.'}
          </p>
        </>
      )}
      {!editable && !score && <p className="guess__hint">Svaret avslöjas av värden när alla har gissat.</p>}

      {open && (
        <div className="guess-sheet__backdrop" onClick={() => setOpen(null)}>
          <div
            role="dialog"
            aria-modal="true"
            aria-label={`Vilken glögg är nummer ${open}?`}
            className="guess-sheet"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="guess-sheet__head">
              <span className="guess-sheet__title">Vilken glögg är nummer {open}?</span>
              <button type="button" className="icon-close" aria-label="Stäng" onClick={() => setOpen(null)}>
                <svg aria-hidden="true" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
                  <path d="M6 6l12 12M18 6L6 18" />
                </svg>
              </button>
            </div>
            <div className="guess-sheet__options">
              {gloggs.map((g) => {
                const by = Object.entries(map).find(([, id]) => id === g.gId)?.[0]
                const taken = by !== undefined && by !== open
                return (
                  <GuessOption
                    key={g.gId}
                    name={g.name}
                    imageId={g.imageId}
                    mine={by === open}
                    takenBy={taken ? by : undefined}
                    onPick={() => choose(g.gId)}
                  />
                )
              })}
            </div>
          </div>
        </div>
      )}
    </main>
  )
}

function GuessThumb({ imageId, visible }: { imageId?: string; visible: boolean }) {
  const src = useAsset(imageId)
  return <span className={`guess-row__thumb${visible ? '' : ' guess-row__thumb--hidden'}`}>{src && <img src={src} alt="" />}</span>
}

type OptionProps = { name: string; imageId?: string; mine: boolean; takenBy?: string; onPick: () => void }

function GuessOption({ name, imageId, mine, takenBy, onPick }: OptionProps) {
  const src = useAsset(imageId)
  return (
    <button
      type="button"
      className={`guess-option${mine ? ' guess-option--mine' : ''}${takenBy ? ' guess-option--taken' : ''}`}
      aria-label={`${name}${takenBy ? `, vald till nummer ${takenBy}` : ''}`}
      aria-pressed={mine}
      onClick={onPick}
    >
      <span className="guess-option__image">
        {src && <img src={src} alt="" />}
        {takenBy && <span className="guess-option__taken">Nr {takenBy}</span>}
      </span>
      <span className="guess-option__name">{name}</span>
    </button>
  )
}
