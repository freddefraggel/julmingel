// Vilken kväll admin styr. Väljs med #/admin?e=<eventId> eller i formuläret,
// och sparas på admin-enheten så att en omladdning hamnar i samma kväll.
// Lagringen är bara en bekvämlighet och får saknas.

const STORAGE_KEY = 'julmingel.adminEvent'

export function readAdminEventId(search: string): string | null {
  const fromLink = new URLSearchParams(search).get('e')?.trim()
  if (fromLink) {
    rememberAdminEventId(fromLink)
    return fromLink
  }
  try {
    return localStorage.getItem(STORAGE_KEY) || null
  } catch {
    return null
  }
}

export function rememberAdminEventId(eventId: string | null) {
  try {
    if (eventId) localStorage.setItem(STORAGE_KEY, eventId)
    else localStorage.removeItem(STORAGE_KEY)
  } catch {
    // Privat läge eller blockerad lagring: admin får välja kväll igen.
  }
}
