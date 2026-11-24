// Glöggprovningen hos admin: serveringsordning, status och hur många som har rankat.
// Rena funktioner utan Firebase, så att de kan testas.
import type { EventConfig, GloggNumber, Guest, GuestClass, GuestRatings, TastingState } from '../types'

export type TastingStatus = 'done' | 'now' | 'next' | 'wait'

export type TastingRow = {
  number: number
  gId: string
  name: string
  description: string
  imageId?: string
  status: TastingStatus
}

export const STATUS_LABEL: Record<TastingStatus, string> = {
  done: 'Serverad',
  now: 'Serveras nu',
  next: 'Förbered',
  wait: 'Väntar',
}

/**
 * Klassens glögger i serveringsordning (secret/numbers), med status.
 * Allt före det som serveras räknas som serverat.
 */
export function tastingRows(
  numbers: Record<GloggNumber, string> | undefined,
  gloggs: EventConfig['gloggs'],
  state: TastingState | undefined,
): TastingRow[] {
  const serving = state?.serving ?? null
  const next = state?.next ?? null
  return Object.entries(numbers ?? {})
    .map(([n, gId]) => ({ number: Number(n), gId }))
    .filter(({ number }) => Number.isInteger(number) && number > 0)
    .sort((a, b) => a.number - b.number)
    .map(({ number, gId }) => {
      const glogg = gloggs?.[gId]
      let status: TastingStatus = 'wait'
      if (number === serving) status = 'now'
      else if (number === next) status = 'next'
      else if (serving !== null && number < serving) status = 'done'
      return {
        number,
        gId,
        name: glogg?.name || `Glögg ${number}`,
        description: glogg?.description ?? '',
        ...(glogg?.imageId ? { imageId: glogg.imageId } : {}),
        status,
      }
    })
}

/** Numret efter `serving` i listan, eller null om det var det sista. Utan servering: det första. */
export function numberAfter(rows: readonly TastingRow[], serving: number | null): number | null {
  if (serving === null) return rows[0]?.number ?? null
  return rows.find((r) => r.number > serving)?.number ?? null
}

/**
 * Vad som ska skrivas när admin trycker på ”Servera nr N”: N serveras, och
 * nästa nummer i ordningen förbereds.
 */
export function serve(rows: readonly TastingRow[], number: number): TastingState {
  return { serving: number, next: numberAfter(rows, number) }
}

/** Uid för gästerna i en klass. */
export function guestsInClass(guests: Record<string, Guest> | null | undefined, guestClass: GuestClass): string[] {
  return Object.entries(guests ?? {})
    .filter(([, g]) => g.class === guestClass)
    .map(([uid]) => uid)
}

/** Hur många av klassens gäster som har satt minst ett betyg på numret. */
export function ratedCount(
  ratings: Record<string, GuestRatings> | null | undefined,
  uids: readonly string[],
  number: number,
): number {
  return uids.filter((uid) => Object.keys(ratings?.[uid]?.[String(number)] ?? {}).length > 0).length
}

/** ”Vanlig · nr 3 av 6 · 14 gäster” */
export function tabLabel(label: string, rows: readonly TastingRow[], serving: number | null, guestCount: number): string {
  const position =
    serving !== null ? `nr ${serving} av ${rows.length}` : rows.length === 1 ? '1 glögg' : `${rows.length} glögger`
  return `${label} · ${position} · ${guestCount} ${guestCount === 1 ? 'gäst' : 'gäster'}`
}
