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
  type SpotifyDevice,
} from '../spotify'
import { Button, Card, Tabs } from '../ui'

const MODES = [
  { value: 'spotify', label: 'Spotify' },
  { value: 'manual', label: 'Reservläge' },
] as const

/**
 * Spotify på admin-enheten: inloggning, vilken enhet låtarna spelas på och
 * reservläget. Sparas på den här enheten, inte i databasen, och gäller direkt.
 */
export function SpotifySetup() {
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
      // Behåll vald enhet om den finns kvar, annars den som spelar nu.
      const current = getDeviceId()
      if (!list.some((d) => d.id === current)) {
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
      await startLogin('#/admin/forbered')
    } catch (e) {
      setError(`Inloggningen misslyckades: ${e instanceof Error ? e.message : String(e)}`)
    }
  }

  const usable = (devices ?? []).filter((d) => d.id && !d.is_restricted)

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
          <div className="spotify-setup__row">
            <label className="prepare__field spotify-setup__device" htmlFor={selectId}>
              <span>Spela på</span>
              <select
                id={selectId}
                className="input"
                value={deviceId}
                disabled={busy || usable.length === 0}
                onChange={(e) => chooseDevice(e.target.value)}
              >
                {usable.length === 0 && <option value="">{busy ? 'Hämtar enheter…' : 'Inga enheter hittades'}</option>}
                {usable.map((d) => (
                  <option key={d.id} value={d.id!}>
                    {d.name} ({d.type}){d.is_active ? ' · spelar nu' : ''}
                  </option>
                ))}
              </select>
            </label>
            <Button variant="secondary" size="small" disabled={busy} onClick={() => void loadDevices()}>
              Uppdatera
            </Button>
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
          </div>
          {devices !== null && usable.length === 0 && (
            <p className="prepare__hint">Öppna Spotify på datorn eller högtalaren som ska spela och tryck på Uppdatera.</p>
          )}
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
