import { get, push, ref, set, update } from 'firebase/database'
import type { Choice, EventConfig, EventSecret, Phase } from '../types'
import { eventPath } from './db'
import { firebase } from './firebase'

export type Preparation = {
  config: EventConfig | null
  joinCode: string | null
  numbers: NonNullable<EventSecret['numbers']> | null
  correct: NonNullable<EventSecret['correct']> | null
  phase: Phase | null
}

/** Läser det som Förbered kvällen redigerar: config/, kod, nummer och facit från secret/, och fasen. */
export async function loadPreparation(eventId: string): Promise<Preparation> {
  const db = firebase().db
  const [config, joinCode, numbers, correct, phase] = await Promise.all([
    get(ref(db, eventPath(eventId, 'config'))),
    get(ref(db, eventPath(eventId, 'secret', 'joinCode'))),
    get(ref(db, eventPath(eventId, 'secret', 'numbers'))),
    get(ref(db, eventPath(eventId, 'secret', 'correct'))),
    get(ref(db, eventPath(eventId, 'live', 'phase'))),
  ])
  return {
    config: config.val() as EventConfig | null,
    joinCode: joinCode.exists() ? String(joinCode.val()) : null,
    numbers: numbers.val() as NonNullable<EventSecret['numbers']> | null,
    correct: correct.val() as NonNullable<EventSecret['correct']> | null,
    phase: phase.val() as Phase | null,
  }
}

/**
 * Ett nytt slumpmässigt id för en glögg, ett kriterium, en låt eller en fråga. Inget skrivs.
 * Glöggernas id avslöjar alltså inte serveringsordningen.
 */
export function newConfigId(eventId: string, kind: 'gloggs' | 'criteria' | 'songs' | 'questions'): string {
  return push(ref(firebase().db, eventPath(eventId, 'config', kind))).key!
}

/**
 * Sparar allt på Förbered kvällen i ett anrop. Varje sökväg skrivs om helt,
 * så borttagna glögger och kriterier försvinner.
 */
export function savePreparation(eventId: string, changes: Record<string, unknown>): Promise<void> {
  return update(ref(firebase().db, eventPath(eventId)), changes)
}

/**
 * Sparar en ny bild på en glögg direkt, eftersom ImageField tar bort den gamla
 * bilden när den nya är sparad. Bara för glögger som redan finns i databasen.
 */
export function setGloggImage(eventId: string, gId: string, imageId: string): Promise<void> {
  return set(ref(firebase().db, eventPath(eventId, 'config', 'gloggs', gId, 'imageId')), imageId)
}

/** Som setGloggImage, för ett bildsvar på en fråga som redan är sparad med svarstypen Bild. */
export function setAnswerImage(eventId: string, qId: string, choice: Choice, imageId: string): Promise<void> {
  return set(ref(firebase().db, eventPath(eventId, 'config', 'questions', qId, 'options', choice)), imageId)
}
