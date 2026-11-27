import { useEffect, useRef, useState } from 'react'
import { getAssets, subscribeConfig, subscribeLive, subscribeNotes, subscribeOwnGuest, subscribeOwnRatings } from '../data'
import type { EventConfig, Guest, GuestNotes, GuestRatings, LiveState } from '../types'
import { useWakeLock } from '../ui'
import { GuestAssets } from './assets'
import { GuestHome, type HomeTarget } from './GuestHome'
import { Gloggs } from './Gloggs'
import { Guess } from './Guess'
import { HomeAfter } from './HomeAfter'
import { Leaderboard } from './Leaderboard'
import { GuestMessage } from './GuestMessage'
import { useQuizLayer } from './QuizLayer'
import { Rate } from './Rate'
import { Review } from './Review'

type Props = {
  eventId: string
  uid: string
  /** Gästens post från registreringen eller inloggningen, tills prenumerationen svarar. */
  guest: Guest
}

/**
 * Gästens kväll efter registreringen. Prenumererar på `live/`, `config/` och
 * gästens egna noder, och renderar läget som står i `live/`. Ingen
 * mobil styr sitt eget flöde, så en omladdad mobil hamnar alltid rätt.
 *
 * En quizfråga läggs som ett lager över sidan gästen står på (useQuizLayer).
 * Under rättningen visas frågan som gås igenom.
 * Ranka glögg öppnas från Hem, och av sig själv när värden serverar en ny
 * glögg i gästens klass. Den stängs när provningen är slut.
 */
export function GuestLive({ eventId, uid, guest: initialGuest }: Props) {
  const [live, setLive] = useState<LiveState | null>(null)
  const [config, setConfig] = useState<EventConfig | null>(null)
  const [guest, setGuest] = useState<Guest | null>(initialGuest)
  const [ratings, setRatings] = useState<GuestRatings>({})
  const [notes, setNotes] = useState<GuestNotes>({})
  const [assets, setAssets] = useState<Record<string, string>>({})
  const [lost, setLost] = useState(false)
  const [view, setView] = useState<'home' | 'topplista' | HomeTarget>('home')
  const lastServing = useRef<number | null>(null)
  const lastStep = useRef<string | undefined>(undefined)

  useEffect(() => {
    const onError = () => setLost(true)
    const unsubscribers = [
      subscribeLive(eventId, setLive, onError),
      subscribeConfig(eventId, setConfig, onError),
      subscribeOwnGuest(eventId, uid, setGuest, onError),
      subscribeOwnRatings(eventId, uid, setRatings, onError),
      subscribeNotes(eventId, uid, setNotes, onError),
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

  const stage = live?.stage
  // Steget i rättning och avslöjande, bara när kvällen är där.
  const step = stage === 'wrapup' ? (live?.wrapup?.step ?? 'review') : undefined
  const serving = guest ? (live?.tasting?.[guest.class]?.serving ?? null) : null
  // Rankningen är öppen i gästens klass; samma villkor som databasreglerna.
  const tastingOpen = guest ? live?.tasting?.[guest.class]?.open === true : false

  // Värden serverar en ny glögg: mobilen hoppar till Ranka glögg, även efter en omladdning.
  useEffect(() => {
    if (!tastingOpen || serving === null || serving === lastServing.current) return
    lastServing.current = serving
    setView('ranka')
  }, [tastingOpen, serving])

  // Gissningen öppnar: mobilen går dit av sig själv, en gång.
  useEffect(() => {
    if (step === lastStep.current) return
    lastStep.current = step
    if (step === 'guess') setView('gissa')
  }, [step])

  // Quizfrågan läggs som ett lager över sidan gästen står på; sidan under ligger kvar.
  const quiz = useQuizLayer({ eventId, uid, config, live: live ?? null })
  // Skärmen hålls vaken medan kvällen pågår, inte i lobbyn eller efteråt.
  useWakeLock(stage === 'evening' || stage === 'wrapup')

  if (!guest) {
    return <GuestMessage title="Du är inte med längre" text="Värden har tagit bort dig från kvällen. Fråga värden om du vill vara med igen." />
  }
  if (lost) {
    return <GuestMessage title="Tappade kontakten" text="Vi når inte kvällen just nu. Ladda om sidan, eller fråga värden." />
  }
  const count = Object.values(config?.gloggs ?? {}).filter((g) => g.class === guest.class).length
  return (
    <GuestAssets.Provider value={assets}>
      <div className="guest-base" aria-hidden={quiz.open || undefined}>
      {stage === 'done' ? (
        view === 'topplista' ? (
          <Leaderboard
            eventId={eventId}
            uid={uid}
            guestClass={guest.class}
            config={config}
            step={live?.wrapup?.revealStep ?? null}
            final
            onBack={() => setView('home')}
          />
        ) : (
          <HomeAfter eventId={eventId} uid={uid} guest={guest} onOpenLeaderboard={() => setView('topplista')} />
        )
      ) : step === 'reveal' ? (
        <Leaderboard
          eventId={eventId}
          uid={uid}
          guestClass={guest.class}
          config={config}
          step={live?.wrapup?.revealStep ?? null}
          final={false}
        />
      ) : step === 'review' && live ? (
        <Review eventId={eventId} uid={uid} config={config} live={live} />
      ) : view === 'ranka' ? (
        <Rate
          eventId={eventId}
          uid={uid}
          count={count}
          criteria={config?.criteria}
          ratings={ratings}
          notes={notes}
          serving={serving}
          open={tastingOpen}
          onBack={() => setView('home')}
        />
      ) : view === 'gissa' ? (
        <Guess
          eventId={eventId}
          uid={uid}
          config={config}
          guestClass={guest.class}
          guessOpen={step === 'guess'}
          notes={notes}
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
          onOpen={(target) => setView(target)}
        />
      )}
      </div>
      {quiz.pill}
      {quiz.layer}
    </GuestAssets.Provider>
  )
}
