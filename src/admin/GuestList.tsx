import type { Guest, GuestClass } from '../types'
import { Chip } from '../ui'

const CLASS_LABELS: Record<GuestClass, string> = { vanlig: 'Vanlig', alkfri: 'Alkoholfri' }

type Props = {
  guests: Record<string, Guest> | null
  disabled: boolean
  onChangeClass: (uid: string, guest: Guest, guestClass: GuestClass) => void
  onRemove: (uid: string, guest: Guest) => void
}

/** Gäster inne, i den ordning de gick med. Samma namn två gånger märks som möjlig dubblett. */
export function GuestList({ guests, disabled, onChangeClass, onRemove }: Props) {
  const entries = Object.entries(guests ?? {}).sort(
    ([, a], [, b]) => (a.joinedAt ?? 0) - (b.joinedAt ?? 0) || a.name.localeCompare(b.name, 'sv'),
  )
  const duplicates = duplicateNames(entries.map(([, guest]) => guest))
  const perClass = (guestClass: GuestClass) => entries.filter(([, g]) => g.class === guestClass).length

  return (
    <section className="guests" aria-labelledby="guests-title">
      <span id="guests-title" className="eyebrow">
        Gäster
      </span>
      {guests && (
        <div className="admin-row">
          <Chip>Vanlig {perClass('vanlig')}</Chip>
          <Chip>Alkoholfri {perClass('alkfri')}</Chip>
        </div>
      )}
      {guests === null && <p className="muted">Hämtar gäster…</p>}
      {guests && entries.length === 0 && <p className="muted">Inga gäster än. Visa QR-koden så att gästerna kan gå med.</p>}
      <ul className="guests__list">
        {entries.map(([uid, guest]) => (
          <li key={uid} className="guest-row">
            <div className="guest-row__name">
              <strong>{guest.name}</strong>
              {duplicates.has(normalize(guest.name)) && <Chip tone="rose">Dubblett?</Chip>}
            </div>
            <div className="guest-row__actions">
              <select
                className="input guest-row__class"
                aria-label={`Klass för ${guest.name}`}
                value={guest.class}
                disabled={disabled}
                onChange={(e) => onChangeClass(uid, guest, e.target.value as GuestClass)}
              >
                {(Object.keys(CLASS_LABELS) as GuestClass[]).map((value) => (
                  <option key={value} value={value}>
                    {CLASS_LABELS[value]}
                  </option>
                ))}
              </select>
              <button
                type="button"
                className="link-button link-button--danger"
                aria-label={`Ta bort ${guest.name}`}
                disabled={disabled}
                onClick={() => onRemove(uid, guest)}
              >
                Ta bort
              </button>
            </div>
          </li>
        ))}
      </ul>
    </section>
  )
}

function normalize(name: string): string {
  return name.trim().toLocaleLowerCase('sv')
}

function duplicateNames(guests: Guest[]): Set<string> {
  const seen = new Set<string>()
  const duplicates = new Set<string>()
  for (const guest of guests) {
    const name = normalize(guest.name)
    if (seen.has(name)) duplicates.add(name)
    seen.add(name)
  }
  return duplicates
}
