/** Sajtens adress på GitHub Pages. */
export const SITE_URL = 'https://freddefraggel.github.io/julmingel/'

/**
 * Gästlänken i QR-koden: <sajten>#/?e=<eventId>&k=<joinCode>.
 * I utvecklingsläget pekar den på den lokala servern, så att länken går att prova.
 */
export function guestUrl(eventId: string, joinCode: string, siteUrl = defaultSiteUrl()): string {
  const params = new URLSearchParams({ e: eventId, k: joinCode })
  return `${siteUrl}#/?${params.toString()}`
}

function defaultSiteUrl(): string {
  return import.meta.env.DEV ? `${window.location.origin}${import.meta.env.BASE_URL}` : SITE_URL
}
