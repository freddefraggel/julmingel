// Spotify Web API (PKCE) från admin-enheten, med reservläge (manuell spellista).
// Inloggning och uppspelning från spiken i #1; reservläget byggs i #17.

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

// Token-utgången gäller bara den här enheten, så här räcker klientens klocka.
async function accessToken(): Promise<string> {
  const token = storedToken()
  if (!token) throw new SpotifyError('Inte inloggad mot Spotify.', 401)
  if (Date.now() < token.expiresAt) return token.accessToken
  const fresh = await requestToken({
    grant_type: 'refresh_token',
    refresh_token: token.refreshToken,
    client_id: SPOTIFY_CLIENT_ID,
  })
  return fresh.accessToken
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

export async function pause(deviceId: string): Promise<void> {
  await api(`/me/player/pause?device_id=${encodeURIComponent(deviceId)}`, { method: 'PUT' })
}
