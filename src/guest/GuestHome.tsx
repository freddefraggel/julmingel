import type { Guest } from '../types'
import { Card, Garland } from '../ui'

// Tillfällig startsida. Hem med Just nu, Ranka glögg och Musikquiz byggs i #7.
export function GuestHome({ guest }: { guest: Guest }) {
  return (
    <main className="page guest-page">
      <Garland />
      <div>
        <span className="muted">God kväll</span>
        <h1>Hej {guest.name}!</h1>
      </div>
      <Card compact>
        <span className="eyebrow">Just nu</span>
        <span>Du är med! Kvällen börjar snart.</span>
      </Card>
    </main>
  )
}
