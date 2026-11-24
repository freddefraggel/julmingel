// Gästlänken från QR-koden: #/?e=<eventId>&k=<joinCode>.
// Senaste länken sparas i mobilen, så att en gäst som öppnar sidan utan länk
// ändå hamnar i rätt kväll. Lagringen är bara en bekvämlighet och får saknas.

export type GuestLink = { eventId: string; joinCode: string | null }

const STORAGE_KEY = 'julmingel.guestLink'

export function readGuestLink(search: string): GuestLink | null {
  const params = new URLSearchParams(search)
  const eventId = params.get('e')?.trim()
  const joinCode = params.get('k')?.trim() || null
  if (eventId) {
    const link = { eventId, joinCode }
    remember(link)
    return link
  }
  return recall()
}

function remember(link: GuestLink) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(link))
  } catch {
    // Privat läge eller blockerad lagring: länken i adressfältet räcker.
  }
}

function recall(): GuestLink | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    const value = JSON.parse(raw) as Partial<GuestLink>
    return typeof value.eventId === 'string' && value.eventId
      ? { eventId: value.eventId, joinCode: typeof value.joinCode === 'string' ? value.joinCode : null }
      : null
  } catch {
    return null
  }
}
