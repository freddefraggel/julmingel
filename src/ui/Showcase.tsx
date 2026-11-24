import { useEffect, useState } from 'react'
import type { GuestClass } from '../types'
import { Button, Card, Chip, CupTimer, Stars, Tabs } from './index'

const TOTAL = 30

function starsFor(secondsLeft: number) {
  const left = secondsLeft / TOTAL
  return left > 0.75 ? 3 : left > 0.5 ? 2 : left > 0.25 ? 1 : 0
}

/** Visningssida för grundkomponenterna. Nås på #/design, bara med npm run dev. */
export default function Showcase() {
  const [guestClass, setGuestClass] = useState<GuestClass>('vanlig')
  const [secondsLeft, setSecondsLeft] = useState(TOTAL)

  useEffect(() => {
    const id = setInterval(() => setSecondsLeft((s) => (s <= -3 ? TOTAL : s - 1)), 1000)
    return () => clearInterval(id)
  }, [])

  return (
    <main className="page">
      <span className="eyebrow eyebrow--gold">Grundkomponenter</span>
      <h1>Designtoken</h1>

      <Tabs
        label="Glöggprovning"
        value={guestClass}
        onChange={setGuestClass}
        options={[
          { value: 'vanlig', label: 'Vanlig' },
          { value: 'alkfri', label: 'Alkoholfri' },
        ]}
      />

      <Card compact>
        <span className="eyebrow">Just nu</span>
        <span>Glöggprovning pågår</span>
      </Card>

      <Card variant="accent">
        <h2>Ranka glögg</h2>
        <span>3 av 6 provade</span>
      </Card>

      <Card>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h2>Musikquiz</h2>
          <Chip>Startar snart</Chip>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Stars count={starsFor(secondsLeft)} />
          <CupTimer secondsLeft={secondsLeft} totalSeconds={TOTAL} />
        </div>
      </Card>

      <Card variant="dashed" compact>
        Gissa glöggen öppnar i slutet av kvällen
      </Card>

      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <Chip>Johan</Chip>
        <Chip tone="rose">lågt = bra</Chip>
        <Chip tone="gold">Vinnare</Chip>
        <Chip tone="green">Rätt</Chip>
      </div>

      <Button block>Gå med</Button>
      <Button variant="secondary" size="small">
        Visa QR-kod
      </Button>
    </main>
  )
}
