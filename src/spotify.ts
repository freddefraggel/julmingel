// Spotify Web API (PKCE) från admin-enheten, med reservläge (manuell spellista).
// All Spotify-logik ligger här. Vyerna anropar startSong()/replaySong() och visar
// resultatet; i reservläget blir det en instruktion i stället för ett API-anrop.

import type { Song } from './types'

// Klient-ID för Spotify-appen (Development Mode). PKCE använder ingen client
// secret, så ID:t är publikt och får ligga i koden.
export const SPOTIFY_CLIENT_ID = '2e1376fa3c644a94ae04f683c7ee433a'

const SCOPES = ['user-read-playback-state', 'user-modify-playback-state']
const AUTH_URL = 'https://accounts.spotify.com/authorize'
const TOKEN_URL = 'https://accounts.spotify.com/api/token'
const API_URL = 'https://api.spotify.com/v1'

const KEY_VERIFIER = 'spotify.verifier'
const KEY_STATE = 'spotify.state'
const KEY_RETURN = 'spotify.return'
const KEY_TOKEN = 'spotify.token'
// Enhet och reservläge gäller admin-enheten och ska överleva en omladdning mitt i kvällen.
const KEY_DEVICE = 'spotify.device'
const KEY_MODE = 'spotify.mode'

type StoredToken = { accessToken: string; refreshToken: string; expiresAt: number }

export type SpotifyDevice = {
  id: string | null
  name: string
  type: string
  is_active: boolean
  is_restricted: boolean
  volume_percent: number | null
}

export class SpotifyError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message)
    this.name = 'SpotifyError'
  }
}

/** Redirect-URI: sajtens rot, t.ex. https://freddefraggel.github.io/julmingel/ eller http://127.0.0.1:5173/julmingel/. */
export function redirectUri(): string {
  return window.location.origin + import.meta.env.BASE_URL
}

/** `https://open.spotify.com/track/<id>` (även med `intl-xx/` och `?si=`) eller `spotify:track:<id>` → `spotify:track:<id>`. */
export function parseTrackLink(input: string): string | null {
  const text = input.trim()
  const uri = /^spotify:track:([A-Za-z0-9]{22})$/.exec(text)
  if (uri) return `spotify:track:${uri[1]}`
  const url = /^https?:\/\/open\.spotify\.com\/(?:intl-[a-z-]+\/)?track\/([A-Za-z0-9]{22})(?:[/?#].*)?$/.exec(text)
  return url ? `spotify:track:${url[1]}` : null
}

// --- PKCE ---------------------------------------------------------------

function base64Url(bytes: Uint8Array): string {
  let binary = ''
  for (const byte of bytes) binary += String.fromCharCode(byte)
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

function randomString(byteLength: number): string {
  return base64Url(crypto.getRandomValues(new Uint8Array(byteLength)))
}

export async function codeChallenge(verifier: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier))
  return base64Url(new Uint8Array(digest))
}

/** Skickar admin till Spotifys inloggning. `returnHash` är vyn att komma tillbaka till, t.ex. `#/admin`. */
export async function startLogin(returnHash: string): Promise<void> {
  const verifier = randomString(64)
  const state = randomString(16)
  sessionStorage.setItem(KEY_VERIFIER, verifier)
  sessionStorage.setItem(KEY_STATE, state)
  sessionStorage.setItem(KEY_RETURN, returnHash)

  const params = new URLSearchParams({
    client_id: SPOTIFY_CLIENT_ID,
    response_type: 'code',
    redirect_uri: redirectUri(),
    scope: SCOPES.join(' '),
    code_challenge_method: 'S256',
    code_challenge: await codeChallenge(verifier),
    state,
  })
  window.location.assign(`${AUTH_URL}?${params}`)
}

/**
 * Körs vid sidstart. Om Spotify just skickat tillbaka oss (`?code=…` eller `?error=…`)
 * byts koden mot token och adressen städas till den sparade vyn. Fel sparas så att vyn kan visa dem.
 */
export async function completeLogin(): Promise<void> {
  const params = new URLSearchParams(window.location.search)
  const code = params.get('code')
  const error = params.get('error')
  if (!code && !error) return

  const returnHash = sessionStorage.getItem(KEY_RETURN) ?? '#/admin'
  const verifier = sessionStorage.getItem(KEY_VERIFIER)
  const state = sessionStorage.getItem(KEY_STATE)
  sessionStorage.removeItem(KEY_VERIFIER)
  sessionStorage.removeItem(KEY_STATE)
  sessionStorage.removeItem(KEY_RETURN)
  window.history.replaceState(null, '', import.meta.env.BASE_URL + returnHash)

  try {
    if (error) throw new SpotifyError(`Spotify nekade inloggningen (${error}).`, 0)
    if (!verifier || params.get('state') !== state) throw new SpotifyError('Inloggningen stämmer inte. Försök igen.', 0)
    await requestToken({
      grant_type: 'authorization_code',
      code: code!,
      redirect_uri: redirectUri(),
      client_id: SPOTIFY_CLIENT_ID,
      code_verifier: verifier,
    })
  } catch (e) {
    loginError = e instanceof Error ? e.message : String(e)
  }
}

let loginError: string | null = null

/** Felet från senaste inloggningsförsöket, om det fanns ett. Läses en gång. */
export function takeLoginError(): string | null {
  const message = loginError
  loginError = null
  return message
}

async function requestToken(body: Record<string, string>): Promise<StoredToken> {
  const response = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams(body),
  })
  const data = await response.json().catch(() => ({}))
  if (!response.ok) {
    throw new SpotifyError(`Kunde inte hämta token: ${data.error_description ?? data.error ?? response.status}`, response.status)
  }
  const token: StoredToken = {
    accessToken: data.access_token,
    // Spotify skickar inte alltid en ny refresh-token vid förnyelse; behåll då den gamla.
    refreshToken: data.refresh_token ?? body.refresh_token,
    expiresAt: Date.now() + (data.expires_in - 60) * 1000,
  }
  sessionStorage.setItem(KEY_TOKEN, JSON.stringify(token))
  return token
}

function storedToken(): StoredToken | null {
  const raw = sessionStorage.getItem(KEY_TOKEN)
  return raw ? (JSON.parse(raw) as StoredToken) : null
}

export function isLoggedIn(): boolean {
  return storedToken() !== null
}

export function logout(): void {
  sessionStorage.removeItem(KEY_TOKEN)
}

let refreshing: Promise<StoredToken> | null = null

// Token-utgången gäller bara den här enheten, så här räcker klientens klocka.
async function accessToken(): Promise<string> {
  const token = storedToken()
  if (!token) throw new SpotifyError('Inte inloggad mot Spotify.', 401)
  if (Date.now() < token.expiresAt) return token.accessToken
  // Flera anrop samtidigt ska dela på en förnyelse; Spotify kan ogiltigförklara den gamla refresh-token.
  refreshing ??= requestToken({
    grant_type: 'refresh_token',
    refresh_token: token.refreshToken,
    client_id: SPOTIFY_CLIENT_ID,
  })
    .catch((e: unknown) => {
      // Fungerar inte refresh-token längre måste admin logga in igen.
      if (e instanceof SpotifyError && e.status >= 400 && e.status < 500) logout()
      throw e
    })
    .finally(() => {
      refreshing = null
    })
  return (await refreshing).accessToken
}

// --- Web API --------------------------------------------------------------

async function api(path: string, init: RequestInit = {}): Promise<Response> {
  const response = await fetch(API_URL + path, {
    ...init,
    headers: { Authorization: `Bearer ${await accessToken()}`, 'Content-Type': 'application/json', ...init.headers },
  })
  if (!response.ok) {
    const data = await response.json().catch(() => ({}))
    const reason = data.error?.reason ? ` (${data.error.reason})` : ''
    throw new SpotifyError(`${data.error?.message ?? response.statusText}${reason}`, response.status)
  }
  return response
}

/** Titel och artist för en låt, till fälten på Förbered kvällen. */
export type TrackInfo = { title: string; artist: string | null }

/**
 * Hämtar låtens titel och artist från en `spotify:track:<id>`.
 *
 * Inloggad: Web API (`GET /v1/tracks/{id}`) ger titel och artist. Annars, eller
 * om det inte går: Spotifys öppna oEmbed, som bara ger titeln. Kastar aldrig;
 * null betyder att inget gick att hämta.
 */
export async function getTrackInfo(spotifyUri: string): Promise<TrackInfo | null> {
  const id = /^spotify:track:([A-Za-z0-9]{22})$/.exec(spotifyUri)?.[1]
  if (!id) return null
  if (isLoggedIn()) {
    try {
      const response = await api(`/tracks/${id}`)
      const data = (await response.json()) as { name?: string; artists?: { name?: string }[] }
      const artist = (data.artists ?? []).map((a) => a.name).filter(Boolean).join(', ')
      if (data.name) return { title: data.name, artist: artist || null }
    } catch {
      // Prova oEmbed i stället.
    }
  }
  try {
    const url = `https://open.spotify.com/oembed?url=${encodeURIComponent(`https://open.spotify.com/track/${id}`)}`
    const response = await fetch(url)
    if (!response.ok) return null
    const data = (await response.json()) as { title?: string }
    return data.title ? { title: data.title, artist: null } : null
  } catch {
    return null
  }
}

export async function getDevices(): Promise<SpotifyDevice[]> {
  const response = await api('/me/player/devices')
  const data = (await response.json()) as { devices: SpotifyDevice[] }
  return data.devices
}

/** Startar en låt på en viss enhet från `positionMs`. */
export async function play(deviceId: string, spotifyUri: string, positionMs: number): Promise<void> {
  await api(`/me/player/play?device_id=${encodeURIComponent(deviceId)}`, {
    method: 'PUT',
    body: JSON.stringify({ uris: [spotifyUri], position_ms: positionMs }),
  })
}

/**
 * Flyttar uppspelningen till en enhet som syns i listan men inte är aktiv,
 * t.ex. en iPad som just har vaknat. Spelar inget än (`play: false`).
 */
export async function transferPlayback(deviceId: string): Promise<void> {
  await api('/me/player', { method: 'PUT', body: JSON.stringify({ device_ids: [deviceId], play: false }) })
}

/** Instruktionen när den valda enheten inte syns i Spotify. */
export const DEVICE_HELP =
  'Öppna Spotify på enheten, spela och pausa en låt, stäng av automatisk låsning – tryck sedan Uppdatera enheter.'

/**
 * Ser till att den valda enheten kan spela: finns den i listan men är inaktiv
 * flyttas uppspelningen dit. Ger false om enheten inte syns alls.
 */
async function ensureActive(deviceId: string): Promise<boolean> {
  const device = (await getDevices()).find((d) => d.id === deviceId)
  if (!device) return false
  if (!device.is_active) await transferPlayback(deviceId)
  return true
}

export async function pause(deviceId: string): Promise<void> {
  await api(`/me/player/pause?device_id=${encodeURIComponent(deviceId)}`, { method: 'PUT' })
}

// --- Enhet och reservläge -------------------------------------------------

/** `spotify`: appen startar låtarna. `manual`: admin startar dem för hand från en färdig spellista. */
export type PlaybackMode = 'spotify' | 'manual'

export function getPlaybackMode(): PlaybackMode {
  return localStorage.getItem(KEY_MODE) === 'manual' ? 'manual' : 'spotify'
}

export function setPlaybackMode(mode: PlaybackMode): void {
  localStorage.setItem(KEY_MODE, mode)
}

/** Enheten som valts på Förbered kvällen, t.ex. ”MacBook” eller ”Vardagsrum”. */
export function getDeviceId(): string | null {
  return localStorage.getItem(KEY_DEVICE)
}

export function setDeviceId(deviceId: string | null): void {
  if (deviceId) localStorage.setItem(KEY_DEVICE, deviceId)
  else localStorage.removeItem(KEY_DEVICE)
}

// --- Låtar i quizet ---------------------------------------------------------

/** En låt i quizet, med sitt nummer i spelordningen (1, 2, …). */
export type SongCue = Pick<Song, 'spotifyUri' | 'startMs' | 'title' | 'artist'> & {
  songId: string
  number: number
}

/** Låtarna i spelordningen (`order`), numrerade från 1. Samma ordning som den manuella spellistan. */
export function songCues(songs: Record<string, Song> | undefined): SongCue[] {
  return Object.entries(songs ?? {})
    .sort(([idA, a], [idB, b]) => a.order - b.order || idA.localeCompare(idB))
    .map(([songId, song], index) => ({
      songId,
      number: index + 1,
      spotifyUri: song.spotifyUri,
      startMs: song.startMs,
      title: song.title,
      artist: song.artist,
    }))
}

/** 45000 → ”0:45”, 65000 → ”1:05”. */
export function formatPosition(ms: number): string {
  const seconds = Math.max(0, Math.floor(ms / 1000))
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`
}

/** ”Last Christmas – Wham!”, ”Last Christmas” eller ”Låt 2”. */
export function songLabel(cue: SongCue): string {
  if (!cue.title) return `Låt ${cue.number}`
  return cue.artist ? `${cue.title} – ${cue.artist}` : cue.title
}

/** Instruktionen i reservläget: ”Starta låt 2 – Last Christmas från 0:45”. */
export function manualInstruction(cue: SongCue): string {
  const title = cue.title ? ` – ${cue.title}` : ''
  return `Starta låt ${cue.number}${title} från ${formatPosition(cue.startMs)}`
}

export type StartResult =
  /** Spotify spelar låten. */
  | { kind: 'played'; cue: SongCue }
  /** Admin startar låten för hand. `reason` är satt om appen försökte spela men inte kunde. */
  | { kind: 'manual'; cue: SongCue; instruction: string; reason?: string }

/**
 * Startar en låt från `startMs`, när admin trycker på *Spela låt*.
 *
 * Först kontrolleras att den valda enheten syns i Spotify; en inaktiv enhet får
 * uppspelningen flyttad till sig. Svarar `play` ändå med 404 (ingen aktiv enhet)
 * uppdateras listan en gång och anropet görs om. I reservläget, eller om
 * uppspelningen inte går, blir resultatet en instruktion som kontrollpanelen
 * visar. Kastar aldrig: quizet ska kunna fortsätta oavsett Spotify.
 */
export async function startSong(cue: SongCue): Promise<StartResult> {
  const manual = (reason?: string): StartResult => ({ kind: 'manual', cue, instruction: manualInstruction(cue), reason })
  if (getPlaybackMode() === 'manual') return manual()
  if (!isLoggedIn()) return manual('Inte inloggad mot Spotify.')
  const deviceId = getDeviceId()
  if (!deviceId) return manual('Ingen Spotify-enhet vald.')
  const missing = () => manual(`Spotify hittar inte den valda enheten. ${DEVICE_HELP}`)
  try {
    if (!(await ensureActive(deviceId))) return missing()
    try {
      await play(deviceId, cue.spotifyUri, cue.startMs)
    } catch (e) {
      if (!(e instanceof SpotifyError && e.status === 404)) throw e
      // Ingen aktiv enhet: uppdatera listan en gång och försök igen.
      if (!(await ensureActive(deviceId))) return missing()
      await play(deviceId, cue.spotifyUri, cue.startMs)
    }
    return { kind: 'played', cue }
  } catch (e) {
    return manual(spotifyErrorText(e))
  }
}

/** ”Spela låten igen” i rättningsläget: samma anrop som när låten startade. */
export const replaySong = startSong

function spotifyErrorText(e: unknown): string {
  if (!(e instanceof Error)) return String(e)
  if (e instanceof SpotifyError && e.status === 404) return `Spotify hittar ingen aktiv enhet: ${e.message}`
  if (e instanceof SpotifyError && e.status === 403) return `Spotify tillåter inte uppspelningen: ${e.message}`
  return e.message
}
