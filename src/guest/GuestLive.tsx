import { useEffect, useRef, useState } from 'react'
import { getAssets, subscribeConfig, subscribeLive, subscribeOwnGuest, subscribeOwnRatings } from '../data'
import type { EventConfig, Guest, GuestRatings, LiveState } from '../types'
import { GuestAssets } from './assets'
import { GuestHome, type HomeTarget } from './GuestHome'
import { Gloggs } from './Gloggs'
import { GuestMessage } from './GuestMessage'
import { Quiz } from './Quiz'
import { Rate } from './Rate'

type Props = {
  eventId: string
  uid: string
  /** Gästens post från registreringen eller inloggningen, tills prenumerationen svarar. */
  guest: Guest
}

/** Undersidorna som finns hittills. Gissa glöggen (#21) läggs till här. */
const OPENABLE: readonly HomeTarget[] = ['ranka', 'glogger']

/**
 * Gästens kväll efter registreringen. Prenumererar på `live/`, `config/` och
 * gästens egna noder, och renderar den fas som står i `live/phase`. Ingen
 * mobil styr sitt eget flöde, så en omladdad mobil hamnar alltid rätt.
 *
 * Under musikquizet visar mobilen frågan som quizledaren har öppnat.
 * Ranka glögg öppnas från Hem, och av sig själv när värden serverar en ny
 * glögg i gästens klass. Den stängs när provningen är slut.
 */
export function GuestLive({ eventId, uid, guest: initialGuest }: Props) {
  const [live, setLive] = useState<LiveState | null>(null)
  const [config, setConfig] = useState<EventConfig | null>(null)
  const [guest, setGuest] = useState<Guest | null>(initialGuest)
  const [ratings, setRatings] = useState<GuestRatings>({})
  const [assets, setAssets] = useState<Record<string, string>>({})
  const [lost, setLost] = useState(false)
  const [view, setView] = useState<'home' | HomeTarget>('home')
  const lastServing = useRef<number | null>(null)

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

  const phase = live?.phase
  const serving = guest ? (live?.tasting?.[guest.class]?.serving ?? null) : null

  // Värden serverar en ny glögg: mobilen hoppar till Ranka glögg, även efter en omladdning.
  useEffect(() => {
    if (phase !== 'tasting' || serving === null || serving === lastServing.current) return
    lastServing.current = serving
    setView('ranka')
  }, [phase, serving])

  if (!guest) {
    return <GuestMessage title="Du är inte med längre" text="Värden har tagit bort dig från kvällen. Fråga värden om du vill vara med igen." />
  }
  if (lost) {
    return <GuestMessage title="Tappade kontakten" text="Vi når inte kvällen just nu. Ladda om sidan, eller fråga värden." />
  }
  const count = Object.values(config?.gloggs ?? {}).filter((g) => g.class === guest.class).length
  return (
    <GuestAssets.Provider value={assets}>
      {phase === 'quiz' && live ? (
        <Quiz eventId={eventId} uid={uid} config={config} live={live} />
      ) : view === 'ranka' && phase === 'tasting' ? (
        <Rate
          eventId={eventId}
          uid={uid}
          count={count}
          criteria={config?.criteria}
          ratings={ratings}
          serving={serving}
          onBack={() => setView('home')}
        />
      ) : view === 'glogger' ? (
        <Gloggs gloggs={config?.gloggs} guestClass={guest.class} onBack={() => setView('home')} />
      ) : (
        <GuestHome
          guest={guest}
          live={live}
          config={config}
          ratings={ratings}
          openable={OPENABLE}
          onOpen={(target) => setView(target)}
        />
      )}
    </GuestAssets.Provider>
  )
}
