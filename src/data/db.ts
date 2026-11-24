import { onValue, ref } from 'firebase/database'
import type { EventConfig, GloggEvent, LiveState } from '../types'
import { firebase } from './firebase'

/** Anropas om prenumerationen avbryts, t.ex. när reglerna nekar läsningen. */
export type OnError = (error: Error) => void

/** Sökväg under /events/{eventId}, t.ex. eventPath(e, 'live', 'phase'). */
export function eventPath(eventId: string, ...parts: string[]): string {
  return ['events', eventId, ...parts].join('/')
}

function subscribe<T>(path: string, callback: (value: T | null) => void, onError?: OnError): () => void {
  return onValue(
    ref(firebase().db, path),
    (snapshot) => callback(snapshot.val() as T | null),
    (error) => onError?.(error),
  )
}

export function subscribeLive(eventId: string, callback: (live: LiveState | null) => void, onError?: OnError): () => void {
  return subscribe<GloggEvent['live']>(eventPath(eventId, 'live'), callback, onError)
}

export function subscribeConfig(
  eventId: string,
  callback: (config: EventConfig | null) => void,
  onError?: OnError,
): () => void {
  return subscribe<GloggEvent['config']>(eventPath(eventId, 'config'), callback, onError)
}

/**
 * Skillnaden mellan serverns och mobilens klocka i ms. Serverns tid = Date.now() + offset.
 * Används för nedräkningen, så att mobilens egen klocka aldrig avgör tiden.
 */
export function subscribeServerTimeOffset(callback: (offsetMs: number) => void): () => void {
  return subscribe<number>('.info/serverTimeOffset', (offset) => callback(offset ?? 0))
}
