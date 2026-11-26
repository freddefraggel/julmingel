import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  codeChallenge,
  formatPosition,
  getTrackInfo,
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


/** Låtsas-Spotify som svarar efter adress. `play` tar ett svar per anrop, i ordning. */
function spotifyApi(fetchMock: ReturnType<typeof vi.fn<typeof fetch>>, opts: { devices?: object[]; play?: Response[] } = {}) {
  const devices = opts.devices ?? [{ id: 'vardagsrum', name: 'Vardagsrum', type: 'Speaker', is_active: true, is_restricted: false }]
  const plays = [...(opts.play ?? [])]
  fetchMock.mockImplementation(async (url) => {
    const u = String(url)
    if (u.includes('accounts.spotify.com')) return json({ access_token: 'ny', expires_in: 3600 })
    if (u.endsWith('/me/player/devices')) return json({ devices })
    if (u.includes('/me/player/play')) return plays.shift() ?? json(null, 204)
    return json(null, 204)
  })
}

const calls = (fetchMock: ReturnType<typeof vi.fn<typeof fetch>>) =>
  fetchMock.mock.calls.map(([url, init]) => `${init?.method ?? 'GET'} ${String(url).replace('https://api.spotify.com/v1', '')}`)

describe('startSong', () => {
  const fetchMock = vi.fn<typeof fetch>()

  beforeEach(() => {
    sessionStorage.clear()
    localStorage.clear()
    fetchMock.mockReset()
    vi.stubGlobal('fetch', fetchMock)
    // Kontrollen av positionen efter play körs med timers; falska timers så att den aldrig når riktiga fetch.
    vi.useFakeTimers({ toFake: ['setTimeout'] })
  })

  afterEach(() => {
    vi.clearAllTimers()
    vi.useRealTimers()
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
    spotifyApi(fetchMock)

    expect(await startSong(cue)).toEqual({ kind: 'played', cue })
    expect(calls(fetchMock)).toEqual(['GET /me/player/devices', 'PUT /me/player/play?device_id=vardagsrum'])
    const [url, init] = fetchMock.mock.calls[1]!
    expect(url).toBe('https://api.spotify.com/v1/me/player/play?device_id=vardagsrum')
    expect(init?.method).toBe('PUT')
    expect(JSON.parse(init?.body as string)).toEqual({ uris: [cue.spotifyUri], position_ms: 45_000 })
    expect(authorization(init)).toBe('Bearer gammal')
  })

  it('”Spela låten igen” gör samma anrop', async () => {
    storeToken(Date.now() + 60_000)
    setDeviceId('vardagsrum')
    spotifyApi(fetchMock)
    await startSong(cue)
    await replaySong(cue)
    expect(fetchMock.mock.calls.slice(2)).toEqual(fetchMock.mock.calls.slice(0, 2))
  })

  it('faller tillbaka på instruktionen när Spotify nekar', async () => {
    storeToken(Date.now() + 60_000)
    setDeviceId('vardagsrum')
    spotifyApi(fetchMock, { play: [json({ error: { status: 403, message: 'Forbidden' } }, 403)] })

    expect(await startSong(cue)).toMatchObject({
      kind: 'manual',
      instruction: 'Starta låt 2 – Last Christmas från 0:45',
      reason: 'Spotify tillåter inte uppspelningen: Forbidden',
    })
  })

  it('flyttar uppspelningen till en enhet som syns men är inaktiv, innan play', async () => {
    storeToken(Date.now() + 60_000)
    setDeviceId('ipad')
    spotifyApi(fetchMock, { devices: [{ id: 'ipad', name: 'iPad', type: 'Tablet', is_active: false, is_restricted: false }] })

    expect(await startSong(cue)).toEqual({ kind: 'played', cue })
    expect(calls(fetchMock)).toEqual(['GET /me/player/devices', 'PUT /me/player', 'PUT /me/player/play?device_id=ipad'])
    expect(JSON.parse(fetchMock.mock.calls[1]![1]!.body as string)).toEqual({ device_ids: ['ipad'], play: false })
  })

  it('saknas den valda enheten blir det reservläget med instruktionen', async () => {
    storeToken(Date.now() + 60_000)
    setDeviceId('ipad')
    spotifyApi(fetchMock, { devices: [] })

    const result = await startSong(cue)
    expect(result).toMatchObject({ kind: 'manual' })
    expect(result.kind === 'manual' && result.reason).toContain('spela och pausa en låt, stäng av automatisk låsning')
    expect(calls(fetchMock)).toEqual(['GET /me/player/devices'])
  })

  it('svarar play med 404 uppdateras listan en gång och anropet görs om', async () => {
    storeToken(Date.now() + 60_000)
    setDeviceId('vardagsrum')
    spotifyApi(fetchMock, { play: [json({ error: { status: 404, message: 'No active device' } }, 404)] })

    expect(await startSong(cue)).toEqual({ kind: 'played', cue })
    expect(calls(fetchMock)).toEqual([
      'GET /me/player/devices',
      'PUT /me/player/play?device_id=vardagsrum',
      'GET /me/player/devices',
      'PUT /me/player/play?device_id=vardagsrum',
    ])
  })

  it('svarar play med 404 två gånger blir det reservläget', async () => {
    storeToken(Date.now() + 60_000)
    setDeviceId('vardagsrum')
    const notFound = () => json({ error: { status: 404, message: 'No active device' } }, 404)
    spotifyApi(fetchMock, { play: [notFound(), notFound()] })

    expect(await startSong(cue)).toMatchObject({ kind: 'manual', reason: expect.stringContaining('hittar ingen aktiv enhet') })
    expect(calls(fetchMock).filter((c) => c.includes('/me/player/play'))).toHaveLength(2)
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
    spotifyApi(fetchMock)

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

describe('startSong med fade-in', () => {
  const fetchMock = vi.fn<typeof fetch>()

  beforeEach(() => {
    sessionStorage.clear()
    localStorage.clear()
    fetchMock.mockReset()
    vi.stubGlobal('fetch', fetchMock)
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.unstubAllGlobals()
  })

  const speaker = { id: 'vardagsrum', name: 'Vardagsrum', type: 'Speaker', is_active: true, is_restricted: false, volume_percent: 60 }

  it('börjar lågt, spelar från vald position och höjer volymen stegvis till enhetens volym', async () => {
    storeToken(Date.now() + 60_000)
    setDeviceId('vardagsrum')
    spotifyApi(fetchMock, { devices: [speaker] })

    expect(await startSong(cue, { positionMs: 30_000, fadeInMs: 1_500 })).toEqual({ kind: 'played', cue })
    expect(calls(fetchMock)).toEqual([
      'GET /me/player/devices',
      'PUT /me/player/volume?volume_percent=6&device_id=vardagsrum',
      'PUT /me/player/play?device_id=vardagsrum',
    ])
    expect(JSON.parse(fetchMock.mock.calls[2]![1]!.body as string)).toEqual({ uris: [cue.spotifyUri], position_ms: 30_000 })
    await vi.runAllTimersAsync()
    const volumes = calls(fetchMock)
      .filter((c) => c.includes('/volume'))
      .map((c) => Number(/volume_percent=(\d+)/.exec(c)![1]))
    expect(volumes).toEqual([6, 15, 24, 33, 42, 51, 60])
  })

  const SEEK = 'PUT /me/player/seek?position_ms=30000&device_id=vardagsrum'

  /** Svarar på GET /me/player med tillstånden i tur och ordning; det sista upprepas. */
  function withPlayback(states: (object | null)[]) {
    const queue = [...states]
    fetchMock.mockImplementation(async (url, init) => {
      const u = String(url)
      if (u.endsWith('/me/player/devices')) return json({ devices: [speaker] })
      if (u.endsWith('/me/player') && (init?.method ?? 'GET') === 'GET') {
        const state = queue.length > 1 ? queue.shift()! : queue[0]!
        return state ? json(state) : json(null, 204)
      }
      return json(null, 204)
    })
  }
  const playing = (progress_ms: number) => ({ is_playing: true, progress_ms, item: { uri: cue.spotifyUri } })
  const playbackChecks = () => calls(fetchMock).filter((c) => c === 'GET /me/player').length

  it('hoppar till positionen så fort låten syns ha startat från början', async () => {
    storeToken(Date.now() + 60_000)
    setDeviceId('vardagsrum')
    withPlayback([playing(200)])
    await startSong(cue, { positionMs: 30_000 })
    expect(calls(fetchMock)).not.toContain(SEEK)
    await vi.advanceTimersByTimeAsync(150)
    expect(calls(fetchMock)).toContain(SEEK)
    await vi.runAllTimersAsync()
    expect(playbackChecks()).toBe(1)
  })

  it('hoppar inte när Spotify startade låten på rätt ställe', async () => {
    storeToken(Date.now() + 60_000)
    setDeviceId('vardagsrum')
    withPlayback([playing(30_150)])
    await startSong(cue, { positionMs: 30_000 })
    await vi.runAllTimersAsync()
    expect(calls(fetchMock)).not.toContain(SEEK)
    expect(playbackChecks()).toBe(1)
  })

  it('frågar igen tills låten spelar, och hoppar då', async () => {
    storeToken(Date.now() + 60_000)
    setDeviceId('vardagsrum')
    const other = { is_playing: true, progress_ms: 90_000, item: { uri: 'spotify:track:annan' } }
    withPlayback([null, other, playing(100)])
    await startSong(cue, { positionMs: 30_000 })
    await vi.advanceTimersByTimeAsync(300)
    expect(calls(fetchMock)).not.toContain(SEEK)
    await vi.advanceTimersByTimeAsync(150)
    expect(calls(fetchMock)).toContain(SEEK)
    expect(playbackChecks()).toBe(3)
  })

  it('syns låten aldrig spela hoppar appen ändå efter cirka 3 sekunder', async () => {
    storeToken(Date.now() + 60_000)
    setDeviceId('vardagsrum')
    withPlayback([null])
    await startSong(cue, { positionMs: 30_000 })
    await vi.advanceTimersByTimeAsync(2_000)
    expect(calls(fetchMock)).not.toContain(SEEK)
    await vi.runAllTimersAsync()
    expect(calls(fetchMock)).toContain(SEEK)
    expect(playbackChecks()).toBe(20)
  })

  it('ingen position, inga frågor', async () => {
    storeToken(Date.now() + 60_000)
    setDeviceId('vardagsrum')
    withPlayback([playing(0)])
    await startSong({ ...cue, startMs: 0 })
    await vi.runAllTimersAsync()
    expect(playbackChecks()).toBe(0)
  })

  it('ett fel på seek stoppar inte uppspelningen', async () => {
    storeToken(Date.now() + 60_000)
    setDeviceId('vardagsrum')
    fetchMock.mockImplementation(async (url) => {
      const u = String(url)
      if (u.endsWith('/me/player/devices')) return json({ devices: [speaker] })
      if (u.includes('/seek')) return json({ error: { status: 403, message: 'Restricted' } }, 403)
      return json(null, 204)
    })
    expect(await startSong(cue, { positionMs: 30_000 })).toEqual({ kind: 'played', cue })
    await vi.runAllTimersAsync()
  })

  it('tillåter enheten inte volymstyrning spelas låten ändå, utan fade', async () => {
    storeToken(Date.now() + 60_000)
    setDeviceId('ipad')
    const ipad = { ...speaker, id: 'ipad', name: 'iPad', type: 'Tablet' }
    fetchMock.mockImplementation(async (url) => {
      const u = String(url)
      if (u.endsWith('/me/player/devices')) return json({ devices: [ipad] })
      if (u.includes('/volume')) return json({ error: { status: 403, message: 'VOLUME_CONTROL_DISALLOW' } }, 403)
      return json(null, 204)
    })
    expect(await startSong(cue, { positionMs: 30_000, fadeInMs: 1_500 })).toEqual({ kind: 'played', cue })
    await vi.runAllTimersAsync()
    expect(calls(fetchMock).filter((c) => c.includes('/volume'))).toHaveLength(1)
    expect(calls(fetchMock).filter((c) => c.includes('/me/player/play'))).toHaveLength(1)
  })

  it('reservlägets instruktion använder positionen', async () => {
    setPlaybackMode('manual')
    expect(await startSong(cue, { positionMs: 30_000 })).toMatchObject({ instruction: 'Starta låt 2 – Last Christmas från 0:30' })
  })
})

describe('getTrackInfo', () => {
  const fetchMock = vi.fn<typeof fetch>()
  const uri = 'spotify:track:2FRnf9qhLbvw8fu4IBXx78'

  beforeEach(() => {
    sessionStorage.clear()
    fetchMock.mockReset()
    vi.stubGlobal('fetch', fetchMock)
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('inloggad: titel och artist från Web API', async () => {
    storeToken(Date.now() + 60_000)
    fetchMock.mockResolvedValue(json({ name: 'Last Christmas', artists: [{ name: 'Wham!' }, { name: 'George Michael' }] }))
    expect(await getTrackInfo(uri)).toEqual({ title: 'Last Christmas', artist: 'Wham!, George Michael' })
    expect(String(fetchMock.mock.calls[0]![0])).toBe('https://api.spotify.com/v1/tracks/2FRnf9qhLbvw8fu4IBXx78')
  })

  it('inte inloggad: bara titeln från oEmbed', async () => {
    fetchMock.mockResolvedValue(json({ title: 'Last Christmas' }))
    expect(await getTrackInfo(uri)).toEqual({ title: 'Last Christmas', artist: null })
    expect(String(fetchMock.mock.calls[0]![0])).toContain('https://open.spotify.com/oembed?url=')
  })

  it('går Web API inte att använda provas oEmbed', async () => {
    storeToken(Date.now() + 60_000)
    fetchMock
      .mockResolvedValueOnce(json({ error: { status: 403, message: 'Forbidden' } }, 403))
      .mockResolvedValueOnce(json({ title: 'Last Christmas' }))
    expect(await getTrackInfo(uri)).toEqual({ title: 'Last Christmas', artist: null })
  })

  it('kastar aldrig: null när inget går att hämta eller länken är fel', async () => {
    fetchMock.mockRejectedValue(new TypeError('Failed to fetch'))
    expect(await getTrackInfo(uri)).toBeNull()
    expect(await getTrackInfo('spotify:album:x')).toBeNull()
  })
})
