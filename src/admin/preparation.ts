// Förbered kvällen: utkastet som admin redigerar, och hur det blir till
// config/ och secret/. Rena funktioner utan Firebase, så att de kan testas.
import type { Criterion, EventConfig, GloggNumber, GuestClass } from '../types'

export const CLASSES: readonly GuestClass[] = ['vanlig', 'alkfri']

export type DraftGlogg = { gId: string; name: string; description: string; imageId?: string }
export type DraftCriterion = { cId: string; name: string; lowIsGood: boolean }

/** Det admin redigerar. Glöggernas plats i listan är deras nummer, alltså serveringsordningen. */
export type Draft = {
  name: string
  joinCode: string
  gloggs: Record<GuestClass, DraftGlogg[]>
  criteria: DraftCriterion[]
}

/** Det som läses från databasen. */
export type Saved = {
  config: EventConfig | null
  joinCode: string | null
  numbers: Partial<Record<GuestClass, Record<GloggNumber, string>>> | null
}

/** Skrivningarna under /events/{eventId}, i ett enda update()-anrop. */
export type SavePayload = {
  'config/name': string
  'config/gloggs': Record<string, { class: GuestClass; name: string; description: string; imageId?: string }>
  'config/criteria': Record<string, Criterion>
  'secret/numbers': Record<GuestClass, Record<GloggNumber, string>>
  'secret/joinCode': string
}

/**
 * Gör om sparade data till ett utkast. Glöggerna sorteras efter sina nummer i
 * secret/numbers. Glögger utan nummer hamnar sist, i gId-ordning.
 */
export function toDraft(saved: Saved, eventId: string): Draft {
  const gloggs = saved.config?.gloggs ?? {}
  const draft: Draft = {
    name: saved.config?.name ?? eventId,
    joinCode: saved.joinCode ?? '',
    gloggs: { vanlig: [], alkfri: [] },
    criteria: Object.entries(saved.config?.criteria ?? {})
      .sort(([a, x], [b, y]) => x.order - y.order || (a < b ? -1 : 1))
      .map(([cId, c]) => ({ cId, name: c.name, lowIsGood: c.lowIsGood === true })),
  }

  for (const cls of CLASSES) {
    const placed = new Set<string>()
    const numbered = Object.entries(saved.numbers?.[cls] ?? {})
      .map(([number, gId]) => ({ number: Number(number), gId }))
      .filter(({ number, gId }) => Number.isFinite(number) && gloggs[gId]?.class === cls)
      .sort((a, b) => a.number - b.number)
    for (const { gId } of numbered) {
      if (placed.has(gId)) continue
      placed.add(gId)
      draft.gloggs[cls].push(toDraftGlogg(gId, gloggs[gId]!))
    }
    const rest = Object.keys(gloggs)
      .filter((gId) => gloggs[gId]!.class === cls && !placed.has(gId))
      .sort()
    for (const gId of rest) draft.gloggs[cls].push(toDraftGlogg(gId, gloggs[gId]!))
  }
  return draft
}

function toDraftGlogg(gId: string, g: NonNullable<EventConfig['gloggs']>[string]): DraftGlogg {
  return { gId, name: g.name ?? '', description: g.description ?? '', ...(g.imageId ? { imageId: g.imageId } : {}) }
}

/** Skrivningarna för ett utkast. Numren börjar på 1 i varje klass. Texterna trimmas. */
export function toPayload(draft: Draft): SavePayload {
  const payload: SavePayload = {
    'config/name': draft.name.trim(),
    'config/gloggs': {},
    'config/criteria': {},
    'secret/numbers': { vanlig: {}, alkfri: {} },
    'secret/joinCode': draft.joinCode.trim(),
  }
  for (const cls of CLASSES) {
    draft.gloggs[cls].forEach((g, i) => {
      payload['config/gloggs'][g.gId] = {
        class: cls,
        name: g.name.trim(),
        description: g.description.trim(),
        ...(g.imageId ? { imageId: g.imageId } : {}),
      }
      payload['secret/numbers'][cls][String(i + 1)] = g.gId
    })
  }
  draft.criteria.forEach((c, i) => {
    payload['config/criteria'][c.cId] = { name: c.name.trim(), order: i + 1, lowIsGood: c.lowIsGood }
  })
  return payload
}

/** Det som måste rättas innan utkastet kan sparas, som texter till admin. Tom lista = går att spara. */
export function problems(draft: Draft): string[] {
  const list: string[] = []
  if (!draft.name.trim()) list.push('Kvällen behöver ett namn.')
  const code = draft.joinCode.trim()
  if (!code) list.push('Kvällen behöver en kod till QR-länken.')
  else if (/\s/.test(code)) list.push('Koden får inte innehålla mellanslag.')
  for (const cls of CLASSES) {
    const missing = draft.gloggs[cls].findIndex((g) => !g.name.trim())
    if (missing >= 0) list.push(`${CLASS_LABEL[cls]} glögg ${missing + 1} saknar namn.`)
  }
  if (draft.criteria.some((c) => !c.name.trim())) list.push('Alla kriterier behöver ett namn.')
  return list
}

/** Bilder som inte längre används när utkastet sparas, t.ex. för borttagna glögger. */
export function unusedImages(saved: Saved, draft: Draft): string[] {
  const kept = new Set(CLASSES.flatMap((cls) => draft.gloggs[cls].map((g) => g.imageId)))
  const before = Object.values(saved.config?.gloggs ?? {}).map((g) => g.imageId)
  return [...new Set(before)].filter((id): id is string => !!id && !kept.has(id))
}

export const CLASS_LABEL: Record<GuestClass, string> = { vanlig: 'Vanlig', alkfri: 'Alkoholfri' }

/** Flyttar ett element ett steg upp (−1) eller ned (+1). Utanför listan händer inget. */
export function move<T>(list: readonly T[], index: number, step: -1 | 1): T[] {
  const to = index + step
  if (index < 0 || index >= list.length || to < 0 || to >= list.length) return [...list]
  const next = [...list]
  ;[next[index], next[to]] = [next[to]!, next[index]!]
  return next
}
