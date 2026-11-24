import { get, push, ref, remove, set } from 'firebase/database'
import type { GloggEvent } from '../types'
import { eventPath, subscribe, type OnError } from './db'
import { firebase } from './firebase'

type Assets = NonNullable<GloggEvent['assets']>

/** Sparar en bild (data-URL eller länk) i assets/ och returnerar dess imageId. */
export async function saveAsset(eventId: string, value: string): Promise<string> {
  const assetRef = push(ref(firebase().db, eventPath(eventId, 'assets')))
  await set(assetRef, value)
  return assetRef.key!
}

export function removeAsset(eventId: string, imageId: string): Promise<void> {
  return remove(ref(firebase().db, eventPath(eventId, 'assets', imageId)))
}

/** Gästens förladdning: alla bilder hämtas en gång när gästen går med, inte som prenumeration. */
export async function getAssets(eventId: string): Promise<Assets> {
  const snapshot = await get(ref(firebase().db, eventPath(eventId, 'assets')))
  return (snapshot.val() as Assets | null) ?? {}
}

/** Admin: bilderna på Förbered kvällen, uppdateras när en bild läggs till eller tas bort. */
export function subscribeAssets(eventId: string, callback: (assets: Assets) => void, onError?: OnError): () => void {
  return subscribe<Assets>(eventPath(eventId, 'assets'), (assets) => callback(assets ?? {}), onError)
}
