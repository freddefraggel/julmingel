import { useEffect, useMemo, useState } from 'react'
import { useLocation } from 'react-router-dom'
import { getOwnGuest, onUserChanged } from '../data'
import type { Guest } from '../types'
import { GuestHome } from './GuestHome'
import { readGuestLink } from './guestLink'
import { GuestMessage } from './GuestMessage'
import { Register } from './Register'
import './guest.css'

type State = { kind: 'loading' } | { kind: 'register' } | { kind: 'home'; guest: Guest }

/**
 * Gästens ingång. En gäst som redan har gått med (samma uid, sparat av Firebase
 * i mobilen) hoppar direkt till Hem; annars visas registreringen.
 */
export default function GuestApp() {
  const { search } = useLocation()
  const link = useMemo(() => readGuestLink(search), [search])
  const eventId = link?.eventId
  const [state, setState] = useState<State>({ kind: 'loading' })

  useEffect(() => {
    if (!eventId) return
    let active = true
    // Bara första beskedet: det säger om mobilen redan har en inloggad gäst.
    // Inloggningen vid registreringen sköts av Register.
    let first = true
    const unsubscribe = onUserChanged((user) => {
      if (!first) return
      first = false
      if (!user) {
        if (active) setState({ kind: 'register' })
        return
      }
      getOwnGuest(eventId, user.uid)
        .then((guest) => {
          if (active) setState(guest ? { kind: 'home', guest } : { kind: 'register' })
        })
        .catch(() => {
          if (active) setState({ kind: 'register' })
        })
    })
    return () => {
      active = false
      unsubscribe()
    }
  }, [eventId])

  if (!link) {
    return <GuestMessage title="Välkommen!" text="Skanna QR-koden hos värden för att gå med i kvällen." />
  }
  if (state.kind === 'loading') {
    return <GuestMessage title="Ett ögonblick…" text="Vi letar upp din plats vid glöggen." busy />
  }
  if (state.kind === 'home') {
    return <GuestHome guest={state.guest} />
  }
  if (!link.joinCode) {
    return <GuestMessage title="Välkommen!" text="Länken saknar kvällens kod. Skanna QR-koden hos värden igen." />
  }
  return (
    <Register
      eventId={link.eventId}
      joinCode={link.joinCode}
      onJoined={(guest) => setState({ kind: 'home', guest })}
    />
  )
}
