import { useEffect } from 'react'

type Sentinel = { released: boolean; release(): Promise<void> }
type WakeLockApi = { request(type: 'screen'): Promise<Sentinel> }

function wakeLockApi(): WakeLockApi | null {
  if (typeof navigator === 'undefined' || !('wakeLock' in navigator)) return null
  return (navigator as Navigator & { wakeLock?: WakeLockApi }).wakeLock ?? null
}

/**
 * Håller skärmen vaken medan `active` är sant (#94), med webbläsarens
 * Screen Wake Lock API. Låset släpps när sidan döljs, så det begärs igen när
 * sidan syns, och vid ett tryck om webbläsaren bara ger låset efter en
 * användarhandling. Saknas stöd, eller nekas låset, händer inget.
 */
export function useWakeLock(active: boolean): void {
  useEffect(() => {
    const api = wakeLockApi()
    if (!active || !api) return
    let sentinel: Sentinel | null = null
    let pending = false
    let stopped = false

    const request = () => {
      if (stopped || pending || document.visibilityState !== 'visible') return
      if (sentinel && !sentinel.released) return
      pending = true
      api
        .request('screen')
        .then((s) => {
          if (stopped) void s.release().catch(() => {})
          else sentinel = s
        })
        .catch(() => {})
        .finally(() => {
          pending = false
        })
    }

    request()
    document.addEventListener('visibilitychange', request)
    document.addEventListener('pointerdown', request)
    return () => {
      stopped = true
      document.removeEventListener('visibilitychange', request)
      document.removeEventListener('pointerdown', request)
      if (sentinel && !sentinel.released) void sentinel.release().catch(() => {})
    }
  }, [active])
}
