import { useEffect, useState } from 'react'
import { subscribeResults } from '../data'
import type { EventResults, Guest, LeaderboardEntry } from '../types'
import { Garland, Snow } from '../ui'

type Cup = { name: string; place: string; metal: 'gold' | 'silver' | 'bronze' }

/** Pokalen för en placering: guld, silver och brons för topp 3, annars ingen. */
export function cupFor(rank: number): Cup | null {
  if (rank === 1) return { name: 'Guldpokal', place: 'Vinnare', metal: 'gold' }
  if (rank === 2) return { name: 'Silverpokal', place: '2:a plats', metal: 'silver' }
  if (rank === 3) return { name: 'Bronspokal', place: '3:e plats', metal: 'bronze' }
  return null
}

type Props = {
  eventId: string
  uid: string
  guest: Guest
  onOpenLeaderboard: () => void
}

/**
 * 8. Hem efter kvällen – med pokal. Placeringen läses från
 * results/leaderboard/{uid} och ligger kvar så länge eventet finns.
 */
export function HomeAfter({ eventId, uid, guest, onOpenLeaderboard }: Props) {
  const [results, setResults] = useState<EventResults | null>(null)
  useEffect(() => subscribeResults(eventId, setResults), [eventId])

  const mine: LeaderboardEntry | undefined = results?.leaderboard?.[uid]
  const cup = mine ? cupFor(mine.rank) : null

  return (
    <main className="page guest-page home home-after">
      <Garland />
      <Snow />
      <header className="home__header">
        <div className="home__greeting">
          <span className="home__hello">Tack för i kväll</span>
          <h1>Hej {guest.name}!</h1>
        </div>
      </header>

      {results === null ? (
        <p className="muted">Hämtar resultatet…</p>
      ) : mine ? (
        <section className={`trophy${cup ? ` trophy--${cup.metal}` : ''}`} aria-label="Din placering">
          {cup ? <CupIcon name={cup.name} /> : <StarIcon />}
          <div className="trophy__text">
            <span className="trophy__name">{cup ? cup.name : `Plats ${mine.rank}`}</span>
            <span className="trophy__place">{cup ? `${cup.place} i musikquizet` : 'i musikquizet'}</span>
          </div>
          <div className="trophy__score">
            <span>{mine.points === 1 ? '1 poäng' : `${mine.points} poäng`}</span>
            <span className="trophy__stars">
              <svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24">
                <path d="M12 3l2.6 5.6 6 .7-4.5 4.1 1.2 6L12 16.4 6.7 19.4l1.2-6L3.4 9.3l6-.7z" fill="currentColor" />
              </svg>
              {mine.stars === 1 ? '1 stjärna' : `${mine.stars} stjärnor`}
            </span>
          </div>
        </section>
      ) : (
        <section className="trophy" aria-label="Din placering">
          <StarIcon />
          <div className="trophy__text">
            <span className="trophy__name">Tack för att du var med!</span>
            <span className="trophy__place">Du finns inte med i quizets topplista.</span>
          </div>
        </section>
      )}

      <div className="home-after__links">
        <button type="button" className="home-after__link" onClick={onOpenLeaderboard}>
          <svg aria-hidden="true" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <path d="M9 18V5l12-2v13" />
            <circle cx="6" cy="18" r="3" />
            <circle cx="18" cy="16" r="3" />
          </svg>
          <span>Quizets topplista</span>
        </button>
        <button type="button" className="home-after__link" onClick={onOpenLeaderboard}>
          <svg aria-hidden="true" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <path d="M6 8h10v6a5 5 0 0 1-10 0z" />
            <path d="M16 9.5h1.5a2.5 2.5 0 0 1 0 5H16" />
            <path d="M9 2.5c-.6 1 .6 1.8 0 3M12.5 2.5c-.6 1 .6 1.8 0 3" />
            <path d="M5 22h12" />
          </svg>
          <span>Kvällens glögg</span>
        </button>
      </div>
    </main>
  )
}

function CupIcon({ name }: { name: string }) {
  return (
    <svg className="trophy__cup" role="img" aria-label={name} width="128" height="128" viewBox="0 0 64 64">
      <path className="trophy__metal trophy__edge" d="M18 8h28v16a14 14 0 0 1-28 0z" strokeWidth="2" strokeLinejoin="round" />
      <path className="trophy__handles" d="M18 13h-6a6 6 0 0 0 6 10M46 13h6a6 6 0 0 1-6 10" fill="none" strokeWidth="3.5" strokeLinecap="round" />
      <path className="trophy__mark" d="M32 13l2.4 5 5.4.6-4 3.7 1.1 5.4L32 25l-4.9 2.7 1.1-5.4-4-3.7 5.4-.6z" />
      <path className="trophy__metal" d="M28 38h8v8h-8z" />
      <rect className="trophy__metal trophy__edge" x="20" y="46" width="24" height="8" rx="2" strokeWidth="2" />
      <path className="trophy__spark" d="M8 10l1.5 3.5L13 15l-3.5 1.5L8 20l-1.5-3.5L3 15l3.5-1.5z" />
      <path className="trophy__spark trophy__spark--late" d="M56 2l1.2 2.8L60 6l-2.8 1.2L56 10l-1.2-2.8L52 6l2.8-1.2z" />
    </svg>
  )
}

function StarIcon() {
  return (
    <svg className="trophy__cup" aria-hidden="true" width="96" height="96" viewBox="0 0 24 24">
      <path className="trophy__star" d="M12 3l2.6 5.6 6 .7-4.5 4.1 1.2 6L12 16.4 6.7 19.4l1.2-6L3.4 9.3l6-.7z" />
    </svg>
  )
}
