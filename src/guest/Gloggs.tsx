import type { EventConfig, GuestClass } from '../types'
import { Garland } from '../ui'
import { useAsset } from './assets'
import { BackButton } from './BackButton'

type Props = {
  gloggs: EventConfig['gloggs']
  guestClass: GuestClass
  onBack: () => void
}

/**
 * Glöggerna i gästens klass i hemlig ordning: sorterade på gId, som är
 * slumpmässigt, och aldrig på nummer. Vilket nummer som är vilken gissar gästen i slutet.
 */
export function gloggsInSecretOrder(gloggs: EventConfig['gloggs'], guestClass: GuestClass) {
  return Object.entries(gloggs ?? {})
    .filter(([, g]) => g.class === guestClass)
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
    .map(([gId, g]) => ({ gId, ...g }))
}

/** 3b. Kvällens glögger: bild, namn och beskrivning. */
export function Gloggs({ gloggs, guestClass, onBack }: Props) {
  const list = gloggsInSecretOrder(gloggs, guestClass)
  return (
    <main className="page guest-page gloggs">
      <Garland />
      <BackButton onClick={onBack} />
      <div className="gloggs__intro">
        <h1>Kvällens glögger</h1>
        <p className="muted">Sorterna i din provning – i hemlig ordning. Vilket nummer som är vilken gissar du i slutet.</p>
      </div>
      {list.length === 0 ? (
        <p className="muted">Värden har inte lagt in några glögger än.</p>
      ) : (
        <ul className="gloggs__grid">
          {list.map((g) => (
            <GloggCard key={g.gId} name={g.name} description={g.description} imageId={g.imageId} />
          ))}
        </ul>
      )}
    </main>
  )
}

function GloggCard({ name, description, imageId }: { name: string; description: string; imageId?: string }) {
  const src = useAsset(imageId)
  return (
    <li className="glogg-card">
      <div className="glogg-card__image">
        {src ? (
          <img src={src} alt="" loading="lazy" />
        ) : (
          <svg aria-hidden="true" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
            <path d="M6 8h10v6a5 5 0 0 1-10 0z" />
            <path d="M16 9.5h1.5a2.5 2.5 0 0 1 0 5H16" />
            <path d="M5 22h12" />
          </svg>
        )}
      </div>
      <div className="glogg-card__text">
        <span className="glogg-card__name">{name}</span>
        {description && <span className="glogg-card__description">{description}</span>}
      </div>
    </li>
  )
}
