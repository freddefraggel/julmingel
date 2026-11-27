import { useState } from 'react'
import { resetEvening } from '../data'
import { Button, Card } from '../ui'

type Status = { kind: 'idle' } | { kind: 'busy' } | { kind: 'done'; guests: boolean } | { kind: 'error' }

/**
 * Nollställ kvällen efter ett testvarv: betyg, anteckningar, quizsvar, gissningar, topplista
 * och kvällens läge tas bort. Glögger, kriterier, låtar, frågor, kod och facit
 * finns kvar, så kvällen behöver inte förberedas igen.
 */
export function ResetCard({ eventId }: { eventId: string }) {
  const [guests, setGuests] = useState(false)
  const [status, setStatus] = useState<Status>({ kind: 'idle' })

  async function reset() {
    const what = guests
      ? 'Alla betyg, anteckningar, quizsvar, gissningar, topplistan och alla gäster tas bort. Gästerna får gå med på nytt.'
      : 'Alla betyg, anteckningar, quizsvar, gissningar och topplistan tas bort. Gästerna finns kvar.'
    if (!window.confirm(`Nollställa kvällen? ${what} Det går inte att ångra.`)) return
    setStatus({ kind: 'busy' })
    try {
      await resetEvening(eventId, guests)
      setStatus({ kind: 'done', guests })
    } catch {
      setStatus({ kind: 'error' })
    }
  }

  return (
    <Card className="prepare__card reset-card">
      <h2>Nollställ kvällen</h2>
      <p className="muted">
        Efter ett testvarv: tar bort betyg, anteckningar, quizsvar, gissningar, topplistan och kvällens läge. Glögger, kriterier, låtar,
        frågor, kod och facit finns kvar.
      </p>
      <label className="reset-card__guests">
        <input type="checkbox" checked={guests} onChange={(e) => setGuests(e.target.checked)} />
        Ta bort gästerna också
      </label>
      <div className="admin-row">
        <Button variant="secondary" size="small" className="reset-card__button" disabled={status.kind === 'busy'} onClick={() => void reset()}>
          {status.kind === 'busy' ? 'Nollställer…' : 'Nollställ kvällen'}
        </Button>
        {status.kind === 'done' && (
          <span role="status" className="reset-card__done">
            Kvällen är nollställd{status.guests ? ', och gästerna är borttagna' : ''}.
          </span>
        )}
      </div>
      {status.kind === 'error' && (
        <p role="alert" className="form-error">
          Kunde inte nollställa kvällen. Kontrollera nätet och försök igen.
        </p>
      )}
    </Card>
  )
}
