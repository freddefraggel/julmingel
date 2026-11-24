import { useEffect, useState } from 'react'
import { saveRatings } from '../data'
import type { Criterion, GuestRatings, Rating } from '../types'
import { Garland } from '../ui'
import { BackButton } from './BackButton'

type Props = {
  eventId: string
  uid: string
  /** Antal glögger i gästens klass. Numren är 1…count. */
  count: number
  criteria: Record<string, Criterion> | undefined
  /** Gästens sparade betyg. */
  ratings: GuestRatings
  /** Numret som serveras nu (`live/tasting/{class}/serving`), eller null. */
  serving: number | null
  onBack: () => void
}

type Status = { kind: 'idle' } | { kind: 'saving' } | { kind: 'saved'; number: number } | { kind: 'error'; message: string }

const VALUES: readonly Rating[] = [1, 2, 3, 4, 5]

/** 3. Ranka glögg: välj nummer, 1–5 per kriterium, Spara. Följer numret som serveras, men gästen kan gå tillbaka. */
export function Rate({ eventId, uid, count, criteria, ratings, serving, onBack }: Props) {
  const [current, setCurrent] = useState<number>(() => clamp(serving ?? 1, count))
  // Ändringar som inte är sparade, per nummer, så att inget försvinner när gästen byter glögg.
  const [drafts, setDrafts] = useState<Record<number, Record<string, Rating>>>({})
  const [status, setStatus] = useState<Status>({ kind: 'idle' })

  // Värden serverar en ny glögg: hoppa dit.
  useEffect(() => {
    if (serving !== null) {
      setCurrent(clamp(serving, count))
      setStatus({ kind: 'idle' })
    }
  }, [serving, count])

  const sorted = Object.entries(criteria ?? {}).sort(([a, x], [b, y]) => x.order - y.order || (a < b ? -1 : 1))
  const saved = ratings[String(current)] ?? {}
  const values = { ...saved, ...drafts[current] }
  const changed = Object.keys(drafts[current] ?? {}).some((cId) => drafts[current]![cId] !== saved[cId])
  const isRated = (n: number) => Object.keys(ratings[String(n)] ?? {}).length > 0

  function pick(cId: string, value: Rating) {
    setDrafts((d) => ({ ...d, [current]: { ...d[current], [cId]: value } }))
    setStatus({ kind: 'idle' })
  }

  async function save() {
    const number = current
    const toSave = drafts[number]
    if (!toSave || Object.keys(toSave).length === 0) return
    setStatus({ kind: 'saving' })
    try {
      await saveRatings(eventId, uid, String(number), toSave)
      setDrafts((d) => {
        const rest = { ...d }
        delete rest[number]
        return rest
      })
      setStatus({ kind: 'saved', number })
    } catch {
      setStatus({ kind: 'error', message: 'Kunde inte spara. Provningen kan vara stängd – fråga värden.' })
    }
  }

  const label =
    status.kind === 'saving'
      ? 'Sparar…'
      : isRated(current) && !changed
        ? 'Sparat – ändra och spara igen'
        : isRated(current)
          ? 'Uppdatera betyg'
          : 'Spara betyg'

  return (
    <main className="page guest-page rate">
      <Garland />
      <BackButton onClick={onBack} />

      <section className="rate__pick" aria-label="Välj glögg">
        <span className="eyebrow">Välj glögg</span>
        <div className="rate__numbers">
          {Array.from({ length: count }, (_, i) => i + 1).map((n) => {
            const classes = ['rate__number']
            if (n === current) classes.push('rate__number--current')
            else if (isRated(n)) classes.push('rate__number--rated')
            return (
              <button
                key={n}
                type="button"
                className={classes.join(' ')}
                aria-pressed={n === current}
                aria-label={`Glögg ${n}${isRated(n) ? ', rankad' : ''}${n === serving ? ', serveras nu' : ''}`}
                onClick={() => {
                  setCurrent(n)
                  setStatus({ kind: 'idle' })
                }}
              >
                {n}
              </button>
            )
          })}
        </div>
      </section>

      <h1>Glögg nr {current}</h1>

      {sorted.length === 0 ? (
        <p className="muted">Värden har inte lagt in några kriterier än.</p>
      ) : (
        <div className="rate__criteria">
          {sorted.map(([cId, criterion]) => (
            <fieldset key={cId} className={`rate-criterion${criterion.lowIsGood ? ' rate-criterion--low' : ''}`}>
              <legend className="rate-criterion__label">
                {criterion.name}
                {criterion.lowIsGood && <span className="rate-criterion__low">lågt = bra</span>}
              </legend>
              <div className="rate-criterion__values">
                {VALUES.map((v) => {
                  const on = (values[cId] ?? 0) >= v
                  return (
                    <button
                      key={v}
                      type="button"
                      className={`rate-criterion__value${on ? ' rate-criterion__value--on' : ''}`}
                      aria-pressed={values[cId] === v}
                      aria-label={`${criterion.name} ${v}`}
                      onClick={() => pick(cId, v)}
                    >
                      {v}
                    </button>
                  )
                })}
              </div>
            </fieldset>
          ))}
        </div>
      )}

      <div className="rate__spacer" />

      <div className="rate__save">
        {status.kind === 'saved' && status.number === current && (
          <p role="status" className="rate__ok">
            Sparat! Dina betyg på glögg {current} är med.
          </p>
        )}
        {status.kind === 'error' && (
          <p role="alert" className="form-error">
            {status.message}
          </p>
        )}
        <button
          type="button"
          className="btn btn--primary btn--large btn--block"
          disabled={!changed || status.kind === 'saving'}
          onClick={() => void save()}
        >
          {label}
        </button>
      </div>
    </main>
  )
}

function clamp(n: number, count: number): number {
  return Math.min(Math.max(1, n), Math.max(1, count))
}
