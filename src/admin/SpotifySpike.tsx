import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  getDeviceId,
  getDevices,
  getPlaybackMode,
  isLoggedIn,
  logout,
  parseTrackLink,
  pause,
  redirectUri,
  setDeviceId as storeDeviceId,
  setPlaybackMode,
  songLabel,
  SpotifyError,
  startLogin,
  startSong,
  takeLoginError,
  type PlaybackMode,
  type SpotifyDevice,
  type StartResult,
} from '../spotify'
import { Button, Card, Chip, Tabs } from '../ui'
import './spotify-spike.css'

const MODES = [
  { value: 'spotify', label: 'Spotify' },
  { value: 'manual', label: 'Reservläge' },
] as const

// Spike för #1: avgör om PKCE-inloggning och play med position_ms fungerar i Development Mode.
// Här kan reservläget (#17) också provas i förväg.
export default function SpotifySpike() {
  const [loggedIn, setLoggedIn] = useState(isLoggedIn)
  const [devices, setDevices] = useState<SpotifyDevice[]>([])
  const [deviceId, setDeviceIdState] = useState(() => getDeviceId() ?? '')
  const [mode, setModeState] = useState<PlaybackMode>(getPlaybackMode)
  const [result, setResult] = useState<StartResult | null>(null)
  const [link, setLink] = useState('https://open.spotify.com/track/2FRnf9qhLbvw8fu4IBXx78')
  const [startSeconds, setStartSeconds] = useState('45')
  const [log, setLog] = useState<string[]>(() => {
    const error = takeLoginError()
    return error ? [`Fel: ${error}`] : []
  })

  const setDeviceId = (id: string) => {
    storeDeviceId(id || null)
    setDeviceIdState(id)
  }

  const setMode = (next: PlaybackMode) => {
    setPlaybackMode(next)
    setModeState(next)
  }

  const write = (line: string) => setLog((lines) => [`${new Date().toLocaleTimeString('sv-SE')}  ${line}`, ...lines])

  const run = async (label: string, action: () => Promise<void>) => {
    try {
      await action()
    } catch (e) {
      const status = e instanceof SpotifyError && e.status ? ` [HTTP ${e.status}]` : ''
      write(`${label} misslyckades${status}: ${e instanceof Error ? e.message : String(e)}`)
    }
  }

  const loadDevices = () =>
    run('Hämta enheter', async () => {
      const list = await getDevices()
      setDevices(list)
      const saved = list.find((d) => d.id === getDeviceId())
      const active = saved ?? list.find((d) => d.is_active) ?? list[0]
      if (active?.id) setDeviceId(active.id)
      write(`Hittade ${list.length} enhet(er): ${list.map((d) => `${d.name} (${d.type})`).join(', ') || 'inga'}`)
    })

  useEffect(() => {
    if (loggedIn) void loadDevices()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loggedIn])

  const uri = parseTrackLink(link)
  const positionMs = Math.max(0, Math.round(Number(startSeconds.replace(',', '.')) * 1000) || 0)

  return (
    <main className="page page--admin spike">
      <p className="eyebrow">Spike #1</p>
      <h1>Spotify-test</h1>
      <p className="muted">
        Redirect-URI för den här adressen: <code>{redirectUri()}</code>
      </p>

      <Card>
        <h2>1. Logga in</h2>
        {loggedIn ? (
          <p>
            Inloggad mot Spotify.{' '}
            <Button
              variant="secondary"
              size="small"
              onClick={() => {
                logout()
                setLoggedIn(false)
                setDevices([])
              }}
            >
              Logga ut
            </Button>
          </p>
        ) : (
          <Button onClick={() => void run('Inloggning', () => startLogin('#/admin/spotify'))}>Logga in med Spotify</Button>
        )}
      </Card>

      <Card>
        <h2>2. Välj enhet</h2>
        <p className="muted">Öppna Spotify-appen på datorn eller telefonen först, annars syns ingen enhet.</p>
        <div className="spike__row">
          <select value={deviceId} onChange={(e) => setDeviceId(e.target.value)} disabled={!devices.length}>
            {!devices.length && <option value="">Inga enheter</option>}
            {devices.map((d) => (
              <option key={d.id ?? d.name} value={d.id ?? ''} disabled={!d.id || d.is_restricted}>
                {d.name} ({d.type}){d.is_active ? ' · aktiv' : ''}
                {d.is_restricted ? ' · kan inte styras' : ''}
              </option>
            ))}
          </select>
          <Button variant="secondary" size="small" disabled={!loggedIn} onClick={() => void loadDevices()}>
            Uppdatera
          </Button>
        </div>
      </Card>

      <Card>
        <h2>3. Spela upp</h2>
        <p className="muted">
          I reservläget spelar appen inget, utan visar vilken låt admin ska starta för hand från spellistan.
        </p>
        <Tabs<PlaybackMode> label="Uppspelning" options={MODES} value={mode} onChange={setMode} />
        <label className="spike__field">
          Spotify-länk
          <input value={link} onChange={(e) => setLink(e.target.value)} />
        </label>
        <label className="spike__field spike__field--short">
          Start (sekunder)
          <input inputMode="decimal" value={startSeconds} onChange={(e) => setStartSeconds(e.target.value)} />
        </label>
        <p className="muted">{uri ? <code>{uri}</code> : 'Ingen giltig spårlänk.'}</p>
        <div className="spike__row">
          <Button
            disabled={!uri}
            onClick={() =>
              void run('Spela', async () => {
                const started = await startSong({ songId: 'test', number: 1, spotifyUri: uri!, startMs: positionMs })
                setResult(started)
                write(
                  started.kind === 'played'
                    ? `Spela ${uri} från ${positionMs / 1000} s: OK`
                    : `Reservläge: ${started.instruction}${started.reason ? ` (${started.reason})` : ''}`,
                )
              })
            }
          >
            Spela
          </Button>
          <Button
            variant="secondary"
            disabled={!loggedIn || !deviceId}
            onClick={() =>
              void run('Pausa', async () => {
                await pause(deviceId)
                write('Pausa: OK')
              })
            }
          >
            Pausa
          </Button>
        </div>
        {result && (
          <p className="spike__result">
            {result.kind === 'played' ? (
              <>
                <Chip tone="green">Spelar på Spotify</Chip> {songLabel(result.cue)}
              </>
            ) : (
              <>
                <Chip tone="gold">Starta för hand</Chip> <strong>{result.instruction}</strong>
                {result.reason && <span className="muted"> · {result.reason}</span>}
              </>
            )}
          </p>
        )}
      </Card>

      <Card>
        <h2>Logg</h2>
        {log.length ? (
          <pre className="spike__log">{log.join('\n')}</pre>
        ) : (
          <p className="muted">Inget hänt än.</p>
        )}
      </Card>

      <p>
        <Link to="/admin">Till kontrollpanelen</Link>
      </p>
    </main>
  )
}
