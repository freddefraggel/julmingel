import { useEffect, useState } from 'react'
import { getAssets, subscribeConfig, subscribeLive, subscribeOwnGuest, subscribeOwnRatings } from '../data'
import type { EventConfig, Guest, GuestRatings, LiveState } from '../types'
import { GuestAssets } from './assets'
import { GuestHome, type HomeTarget } from './GuestHome'
import { GuestMessage } from './GuestMessage'

type Props = {
  eventId: string
  uid: string
  /** Gästens post från registreringen eller inloggningen, tills prenumerationen svarar. */
  guest: Guest
  /** Öppnar en undersida från Hem. Saknas den gör korten ingenting än. */
  onOpen?: (target: HomeTarget) => void
}

/**
 * Gästens kväll efter registreringen. Prenumererar på `live/`, `config/` och
 * gästens egna noder, och renderar den fas som står i `live/phase`. Ingen
 * mobil styr sitt eget flöde, så en omladdad mobil hamnar alltid rätt.
 */
export function GuestLive({ eventId, uid, guest: initialGuest, onOpen }: Props) {
  const [live, setLive] = useState<LiveState | null>(null)
  const [config, setConfig] = useState<EventConfig | null>(null)
  const [guest, setGuest] = useState<Guest | null>(initialGuest)
  const [ratings, setRatings] = useState<GuestRatings>({})
  const [assets, setAssets] = useState<Record<string, string>>({})
  const [lost, setLost] = useState(false)

  useEffect(() => {
    const onError = () => setLost(true)
    const unsubscribers = [
      subscribeLive(eventId, setLive, onError),
      subscribeConfig(eventId, setConfig, onError),
      subscribeOwnGuest(eventId, uid, setGuest, onError),
      subscribeOwnRatings(eventId, uid, setRatings, onError),
    ]
    return () => unsubscribers.forEach((unsubscribe) => unsubscribe())
  }, [eventId, uid])

  // Förladdning: alla bilder en gång, inte som prenumeration.
  useEffect(() => {
    let active = true
    getAssets(eventId)
      .then((loaded) => {
        if (active) setAssets(loaded)
      })
      .catch(() => {})
    return () => {
      active = false
    }
  }, [eventId])

  if (!guest) {
    return <GuestMessage title="Du är inte med längre" text="Värden har tagit bort dig från kvällen. Fråga värden om du vill vara med igen." />
  }
  if (lost) {
    return <GuestMessage title="Tappade kontakten" text="Vi når inte kvällen just nu. Ladda om sidan, eller fråga värden." />
  }
  return (
    <GuestAssets.Provider value={assets}>
      <GuestHome guest={guest} live={live} config={config} ratings={ratings} onOpen={onOpen} />
    </GuestAssets.Provider>
  )
}
