import { useCallback, useEffect, useId, useState } from 'react'
import {
  getDeviceId,
  getDevices,
  getPlaybackMode,
  isLoggedIn,
  logout,
  setDeviceId,
  setPlaybackMode,
  startLogin,
  takeLoginError,
  type PlaybackMode,
  DEVICE_HELP,
  type SpotifyDevice,
} from '../spotify'
import { Button, Card, Tabs } from '../ui'

const MODES = [
  { value: 'spotify', label: 'Spotify' },
  { value: 'manual', label: 'Reservläge' },
] as const

type Props = {
  /** Kompakt rad i kontrollpanelens quizkolumn: bara Spela på och Uppdatera enheter. */
  compact?: boolean
  /** Sidan som Spotify-inloggningen kommer tillbaka till. */
  returnHash?: string
}

/**
 * Spotify på admin-enheten: inloggning, vilken enhet låtarna spelas på och
 * reservläget. Sparas på den här enheten, inte i databasen, och gäller direkt.
 *
 * Listan visar bara enheter där Spotify-appen är vaken och inloggad på samma
 * konto – en iPad försvinner när iOS söver appen. Då visas en instruktion.
 */
export function SpotifySetup({ compact = false, returnHash = '#/admin/forbered' }: Props = {}) {
  const selectId = useId()
  const [mode, setModeState] = useState<PlaybackMode>(getPlaybackMode)
  const [loggedIn, setLoggedIn] = useState(isLoggedIn)
  const [devices, setDevices] = useState<SpotifyDevice[] | null>(null)
  const [deviceId, setDeviceIdState] = useState(() => getDeviceId() ?? '')
  const [error, setError] = useState<string | null>(() => takeLoginError())
  const [busy, setBusy] = useState(false)

  const chooseDevice = (id: string) => {
    setDeviceId(id || null)
    setDeviceIdState(id)
  }

  const loadDevices = useCallback(async () => {
    setBusy(true)
    setError(null)
    try {
      const list = await getDevices()
      setDevices(list)
      // Behåll vald enhet även om den inte syns just nu (då visas instruktionen).
      // Är ingen vald än tas den som spelar nu.
      if (!getDeviceId()) {
        const active = list.find((d) => d.is_active && d.id) ?? list.find((d) => d.id)
        chooseDevice(active?.id ?? '')
      }
    } catch (e) {
      setError(`Kunde inte hämta enheterna: ${e instanceof Error ? e.message : String(e)}`)
      setLoggedIn(isLoggedIn())
    }
    setBusy(false)
  }, [])

  useEffect(() => {
    if (loggedIn && mode === 'spotify') void loadDevices()
  }, [loggedIn, mode, loadDevices])

  function changeMode(next: PlaybackMode) {
    setPlaybackMode(next)
    setModeState(next)
  }

  async function login() {
    setError(null)
    try {
      await startLogin(returnHash)
    } catch (e) {
      setError(`Inloggningen misslyckades: ${e instanceof Error ? e.message : String(e)}`)
    }
  }

  const usable = (devices ?? []).filter((d) => d.id && !d.is_restricted)
  const savedMissing = devices !== null && !!deviceId && !usable.some((d) => d.id === deviceId)
  const help =
    devices !== null && (usable.length === 0 || savedMissing) ? (
      <p className="prepare__hint spotify-setup__help" role="status">
        {savedMissing ? 'Den valda enheten syns inte i Spotify. ' : 'Inga enheter hittades. '}
        {DEVICE_HELP}
      </p>
    ) : null

  const picker = (
    <div className="spotify-setup__row">
      <label className="prepare__field spotify-setup__device" htmlFor={selectId}>
        <span>Spela på</span>
        <select
          id={selectId}
          className="input"
          value={deviceId}
          disabled={busy || (usable.length === 0 && !deviceId)}
          onChange={(e) => chooseDevice(e.target.value)}
        >
          {usable.length === 0 && !deviceId && <option value="">{busy ? 'Hämtar enheter…' : 'Inga enheter hittades'}</option>}
          {savedMissing && <option value={deviceId}>Vald enhet (syns inte nu)</option>}
          {usable.map((d) => (
            <option key={d.id} value={d.id!}>
              {d.name} ({d.type}){d.is_active ? ' · spelar nu' : ''}
            </option>
          ))}
        </select>
      </label>
      <Button variant="secondary" size="small" disabled={busy} onClick={() => void loadDevices()}>
        Uppdatera enheter
      </Button>
      {!compact && (
        <button
          type="button"
          className="link-button"
          onClick={() => {
            logout()
            setLoggedIn(false)
            setDevices(null)
          }}
        >
          Logga ut
        </button>
      )}
    </div>
  )

  if (compact) {
    return (
      <div className="spotify-setup spotify-setup--compact">
        {mode === 'manual' ? (
          <p className="muted">Reservläge: du startar låtarna själv. Byt under Förbered kvällen.</p>
        ) : !loggedIn ? (
          <div className="spotify-setup__row">
            <p className="muted">Inte inloggad mot Spotify.</p>
            <Button size="small" variant="secondary" onClick={login}>
              Logga in med Spotify
            </Button>
          </div>
        ) : (
          picker
        )}
        {mode !== 'manual' && loggedIn && help}
        {error && (
          <p role="alert" className="form-error">
            {error}
          </p>
        )}
      </div>
    )
  }

  return (
    <Card className="prepare__card">
      <div className="prepare__card-head">
        <h2>Spotify</h2>
        <Tabs label="Uppspelning" options={MODES} value={mode} onChange={changeMode} />
      </div>

      {mode === 'manual' ? (
        <p className="muted">
          Reservläge: du startar låtarna själv från en färdig spellista. Kontrollpanelen säger vilken låt och från var, t.ex.
          ”Starta låt 2 – Last Christmas från 0:45”.
        </p>
      ) : !loggedIn ? (
        <div className="spotify-setup__row">
          <p className="muted">Logga in med kontot som har Spotify Premium, så startar appen låtarna själv.</p>
          <Button size="small" onClick={login}>
            Logga in med Spotify
          </Button>
        </div>
      ) : (
        <>
          {picker}
          {help}
        </>
      )}
      {error && (
        <p role="alert" className="form-error">
          {error}
        </p>
      )}
    </Card>
  )
}
