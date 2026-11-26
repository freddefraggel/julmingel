// Kvällar: id, ny kväll och kopiering från en annan kväll. Rena funktioner utan Firebase.
import type { EventConfig, EventSecret } from '../types'

/** En rad i registret `/eventIndex/{id}`. */
export type EventIndexEntry = { name: string; updatedAt?: number }

/** Det som kopieras från en annan kväll: förberedelserna, inte gäster, svar eller resultat. */
export type EventSource = {
  config: EventConfig | null
  assets: Record<string, string> | null
  numbers: EventSecret['numbers'] | null
  correct: EventSecret['correct'] | null
}

export type NewEvent = { eventId: string; name: string; joinCode: string }

/** Id:t i adressen: små bokstäver, siffror och bindestreck, 2–40 tecken. */
export function idProblem(eventId: string): string | null {
  if (!/^[a-z0-9][a-z0-9-]{1,39}$/.test(eventId)) {
    return 'Id:t får bara innehålla små bokstäver a–z, siffror och bindestreck, 2–40 tecken.'
  }
  return null
}

/** Förslag på id från namnet: ”Gröna Villans Glöggmingel 2026” → ”grona-villans-gloggmingel-2026”. */
export function suggestId(name: string): string {
  return name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40)
    .replace(/-+$/, '')
}

/** Det som måste rättas innan kvällen kan skapas. Tom lista = går att skapa. */
export function newEventProblems(input: NewEvent, taken: boolean): string[] {
  const list: string[] = []
  if (!input.name.trim()) list.push('Kvällen behöver ett namn.')
  const idError = idProblem(input.eventId)
  if (idError) list.push(idError)
  else if (taken) list.push(`Det finns redan en kväll med id ”${input.eventId}”.`)
  const code = input.joinCode.trim()
  if (!code) list.push('Kvällen behöver en kod till QR-länken.')
  else if (/\s/.test(code)) list.push('Koden får inte innehålla mellanslag.')
  return list
}

/**
 * Skrivningarna från roten för en ny kväll, i ett anrop. Med en källa kopieras
 * glögger, kriterier, låtar, frågor, bilder, glöggordning och facit. Gäster,
 * betyg, svar, resultat och kvällens läge följer aldrig med, och
 * registreringen börjar stängd.
 */
export function createChanges(input: NewEvent, source: EventSource | null, now: number): Record<string, unknown> {
  const id = input.eventId
  const name = input.name.trim()
  const config: EventConfig = { ...(source?.config ?? {}), name, joinOpen: false } as EventConfig
  const secret: EventSecret = { joinCode: input.joinCode.trim() }
  if (source?.numbers) secret.numbers = source.numbers
  if (source?.correct) secret.correct = source.correct
  const changes: Record<string, unknown> = {
    [`events/${id}/config`]: config,
    [`events/${id}/secret`]: secret,
    [`eventIndex/${id}`]: { name, updatedAt: now },
  }
  if (source?.assets && Object.keys(source.assets).length > 0) changes[`events/${id}/assets`] = source.assets
  return changes
}

/** Kvällarna i registret, senast använda först. */
export function sortedEvents(index: Record<string, EventIndexEntry> | null | undefined): (EventIndexEntry & { eventId: string })[] {
  return Object.entries(index ?? {})
    .map(([eventId, e]) => ({ eventId, ...e }))
    .sort((a, b) => (b.updatedAt ?? 0) - (a.updatedAt ?? 0) || a.eventId.localeCompare(b.eventId))
}
