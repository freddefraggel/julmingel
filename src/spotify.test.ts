import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  codeChallenge,
  formatPosition,
  isLoggedIn,
  manualInstruction,
  parseTrackLink,
  replaySong,
  setDeviceId,
  setPlaybackMode,
  songCues,
  songLabel,
  startSong,
  type SongCue,
} from './spotify'
import type { Song } from './types'

const cue: SongCue = {
  songId: 's2',
  number: 2,
  spotifyUri: 'spotify:track:2FRnf9qhLbvw8fu4IBXx78',
  startMs: 45_000,
  title: 'Last Christmas',
  artist: 'Wham!',
}

function storeToken(expiresAt: number) {
  sessionStorage.setItem('spotify.token', JSON.stringify({ accessToken: 'gammal', refreshToken: 'refresh', expiresAt }))
}

function json(body: unknown, status = 200) {
  return new Response(body === null ? null : JSON.stringify(body), { status })
}

function authorization(init: RequestInit | undefined) {
  return (init?.headers as Record<string, string>).Authorization
}

describe('spotify', () => {
  it('räknar PKCE-challenge enligt RFC 7636', async () => {
    expect(await codeChallenge('dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk')).toBe(
      'E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM',
    )
  })

  it('gör om Spotify-länkar till URI:er', () => {
    const uri = 'spotify:track:2FRnf9qhLbvw8fu4IBXx78'
    expect(parseTrackLink('https://open.spotify.com/track/2FRnf9qhLbvw8fu4IBXx78')).toBe(uri)
    expect(parseTrackLink(' https://open.spotify.com/intl-sv/track/2FRnf9qhLbvw8fu4IBXx78?si=abc ')).toBe(uri)
    expect(parseTrackLink(uri)).toBe(uri)
    expect(parseTrackLink('https://open.spotify.com/album/2FRnf9qhLbvw8fu4IBXx78')).toBeNull()
    expect(parseTrackLink('hej')).toBeNull()
  })
})

describe('låtar och instruktioner', () => {
  it('skriver starttiden som m:ss', () => {
    expect(formatPosition(0)).toBe('0:00')
    expect(formatPosition(45_000)).toBe('0:45')
    expect(formatPosition(65_900)).toBe('1:05')
  })

  it('formulerar reservlägets instruktion', () => {
    expect(manualInstruction(cue)).toBe('Starta låt 2 – Last Christmas från 0:45')
    expect(manualInstruction({ ...cue, title: undefined })).toBe('Starta låt 2 från 0:45')
    expect(songLabel(cue)).toBe('Last Christmas – Wham!')
    expect(songLabel({ ...cue, artist: undefined })).toBe('Last Christmas')
    expect(songLabel({ ...cue, title: undefined })).toBe('Låt 2')
  })

  it('numrerar låtarna i spelordningen', () => {
    const songs: Record<string, Song> = {
      b: { order: 20, spotifyUri: 'spotify:track:b', startMs: 0, secondsPerQuestion: 20 },
      a: { order: 10, spotifyUri: 'spotify:track:a', startMs: 30_000, secondsPerQuestion: 20, title: 'A' },
    }
    expect(songCues(songs).map((c) => [c.songId, c.number])).toEqual([
      ['a', 1],
      ['b', 2],
    ])
    expect(songCues(undefined)).toEqual([])
  })
})

describe('startSong', () => {
  const fetchMock = vi.fn<typeof fetch>()

  beforeEach(() => {
    sessionStorage.clear()
    localStorage.clear()
    fetchMock.mockReset()
    vi.stubGlobal('fetch', fetchMock)
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('spelar inget i reservläget, bara visar instruktionen', async () => {
    storeToken(Date.now() + 60_000)
    setDeviceId('vardagsrum')
    setPlaybackMode('manual')
    expect(await startSong(cue)).toEqual({
      kind: 'manual',
      cue,
      instruction: 'Starta låt 2 – Last Christmas från 0:45',
      reason: undefined,
    })
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('startar låten på vald enhet från startMs', async () => {
    storeToken(Date.now() + 60_000)
    setDeviceId('vardagsrum')
    fetchMock.mockResolvedValue(json(null, 204))

    expect(await startSong(cue)).toEqual({ kind: 'played', cue })
    const [url, init] = fetchMock.mock.calls[0]!
    expect(url).toBe('https://api.spotify.com/v1/me/player/play?device_id=vardagsrum')
    expect(init?.method).toBe('PUT')
    expect(JSON.parse(init?.body as string)).toEqual({ uris: [cue.spotifyUri], position_ms: 45_000 })
    expect(authorization(init)).toBe('Bearer gammal')
  })

  it('”Spela låten igen” gör samma anrop', async () => {
    storeToken(Date.now() + 60_000)
    setDeviceId('vardagsrum')
    fetchMock.mockResolvedValue(json(null, 204))
    await startSong(cue)
    await replaySong(cue)
    expect(fetchMock.mock.calls[1]).toEqual(fetchMock.mock.calls[0])
  })

  it('faller tillbaka på instruktionen när Spotify nekar', async () => {
    storeToken(Date.now() + 60_000)
    setDeviceId('vardagsrum')
    fetchMock.mockResolvedValue(json({ error: { status: 403, message: 'Forbidden' } }, 403))

    expect(await startSong(cue)).toMatchObject({
      kind: 'manual',
      instruction: 'Starta låt 2 – Last Christmas från 0:45',
      reason: 'Spotify tillåter inte uppspelningen: Forbidden',
    })
  })

  it('faller tillbaka utan inloggning eller enhet', async () => {
    expect(await startSong(cue)).toMatchObject({ kind: 'manual', reason: 'Inte inloggad mot Spotify.' })
    storeToken(Date.now() + 60_000)
    expect(await startSong(cue)).toMatchObject({ kind: 'manual', reason: 'Ingen Spotify-enhet vald.' })
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('förnyar en utgången token en gång även vid samtidiga anrop', async () => {
    storeToken(Date.now() - 1)
    setDeviceId('vardagsrum')
    fetchMock.mockImplementation(async (url) =>
      String(url).includes('accounts.spotify.com') ? json({ access_token: 'ny', expires_in: 3600 }) : json(null, 204),
    )

    await Promise.all([startSong(cue), startSong(cue)])
    const tokenCalls = fetchMock.mock.calls.filter(([url]) => String(url).includes('accounts.spotify.com'))
    expect(tokenCalls).toHaveLength(1)
    expect(String(tokenCalls[0]?.[1]?.body)).toContain('grant_type=refresh_token')
    const playCalls = fetchMock.mock.calls.filter(([url]) => String(url).includes('/me/player/play'))
    expect(playCalls.map(([, init]) => authorization(init))).toEqual(['Bearer ny', 'Bearer ny'])
    // Spotify skickade ingen ny refresh-token, så den gamla behålls.
    expect(JSON.parse(sessionStorage.getItem('spotify.token')!).refreshToken).toBe('refresh')
  })

  it('loggar ut när refresh-token inte längre fungerar', async () => {
    storeToken(Date.now() - 1)
    setDeviceId('vardagsrum')
    fetchMock.mockResolvedValue(json({ error: 'invalid_grant', error_description: 'Refresh token revoked' }, 400))

    expect(await startSong(cue)).toMatchObject({
      kind: 'manual',
      reason: 'Kunde inte hämta token: Refresh token revoked',
    })
    expect(isLoggedIn()).toBe(false)
  })
})
