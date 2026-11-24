import { describe, expect, it } from 'vitest'
import { move, problems, toDraft, toPayload, unusedImages, type Draft, type Saved } from './preparation'

const saved: Saved = {
  config: {
    name: 'Julmingel',
    joinOpen: true,
    gloggs: {
      gx: { class: 'vanlig', name: 'Vit', description: 'Kardemumma', imageId: 'i1' },
      ga: { class: 'vanlig', name: 'Röd', description: '' },
      gz: { class: 'vanlig', name: 'Utan nummer', description: '' },
      gb: { class: 'alkfri', name: 'Äpple', description: '' },
    },
    criteria: {
      c2: { name: 'Sötma', order: 2, lowIsGood: true },
      c1: { name: 'Smak', order: 1, lowIsGood: false },
    },
  },
  joinCode: 'glogg',
  // Nummer 1 är gx och 2 är ga, så ordningen styrs inte av gId. gb står fel i vanlig och hoppas över där.
  numbers: { vanlig: { '2': 'ga', '1': 'gx', '3': 'gb' }, alkfri: { '1': 'gb' } },
}

describe('toDraft', () => {
  it('sorterar glöggerna efter numret och lägger glögger utan nummer sist', () => {
    const draft = toDraft(saved, 'demo')
    expect(draft.gloggs.vanlig.map((g) => g.gId)).toEqual(['gx', 'ga', 'gz'])
    expect(draft.gloggs.alkfri.map((g) => g.gId)).toEqual(['gb'])
    expect(draft.gloggs.vanlig[0]).toEqual({ gId: 'gx', name: 'Vit', description: 'Kardemumma', imageId: 'i1' })
  })

  it('sorterar kriterierna efter order', () => {
    expect(toDraft(saved, 'demo').criteria).toEqual([
      { cId: 'c1', name: 'Smak', lowIsGood: false },
      { cId: 'c2', name: 'Sötma', lowIsGood: true },
    ])
  })

  it('klarar en tom kväll', () => {
    expect(toDraft({ config: null, joinCode: null, numbers: null }, 'demo')).toEqual({
      name: 'demo',
      joinCode: '',
      gloggs: { vanlig: [], alkfri: [] },
      criteria: [],
    })
  })
})

describe('toPayload', () => {
  it('ger nummer efter platsen i listan och trimmar texterna', () => {
    const draft = toDraft(saved, 'demo')
    draft.gloggs.vanlig = move(draft.gloggs.vanlig, 2, -1) // gz före ga
    draft.name = '  Glöggkväll  '
    const payload = toPayload(draft)
    expect(payload['secret/numbers']).toEqual({ vanlig: { '1': 'gx', '2': 'gz', '3': 'ga' }, alkfri: { '1': 'gb' } })
    expect(payload['config/name']).toBe('Glöggkväll')
    expect(payload['config/gloggs'].gx).toEqual({ class: 'vanlig', name: 'Vit', description: 'Kardemumma', imageId: 'i1' })
    expect(payload['config/gloggs'].ga).toEqual({ class: 'vanlig', name: 'Röd', description: '' })
    expect(payload['secret/joinCode']).toBe('glogg')
  })

  it('lägger aldrig numren i config/', () => {
    const payload = toPayload(toDraft(saved, 'demo'))
    expect(JSON.stringify(payload['config/gloggs'])).not.toMatch(/number|"[123]"/)
  })

  it('ger kriterierna order efter platsen i listan', () => {
    const draft = toDraft(saved, 'demo')
    draft.criteria = move(draft.criteria, 0, 1)
    expect(toPayload(draft)['config/criteria']).toEqual({
      c2: { name: 'Sötma', order: 1, lowIsGood: true },
      c1: { name: 'Smak', order: 2, lowIsGood: false },
    })
  })

  it('sparat och läst tillbaka ger samma utkast', () => {
    const draft = toDraft(saved, 'demo')
    const payload = toPayload(draft)
    const again = toDraft(
      {
        config: { name: payload['config/name'], joinOpen: true, gloggs: payload['config/gloggs'], criteria: payload['config/criteria'] },
        joinCode: payload['secret/joinCode'],
        numbers: payload['secret/numbers'],
      },
      'demo',
    )
    expect(again).toEqual(draft)
  })
})

describe('problems', () => {
  const ok = (): Draft => toDraft(saved, 'demo')

  it('godkänner ett komplett utkast', () => {
    expect(problems(ok())).toEqual([])
  })

  it('kräver namn, kod utan mellanslag och namn på glögger och kriterier', () => {
    const draft = ok()
    draft.name = ' '
    draft.joinCode = 'två ord'
    draft.gloggs.alkfri[0]!.name = ''
    draft.criteria[1]!.name = ' '
    expect(problems(draft)).toEqual([
      'Kvällen behöver ett namn.',
      'Koden får inte innehålla mellanslag.',
      'Alkoholfri glögg 1 saknar namn.',
      'Alla kriterier behöver ett namn.',
    ])
    draft.joinCode = ''
    expect(problems(draft)).toContain('Kvällen behöver en kod till QR-länken.')
  })
})

describe('unusedImages', () => {
  it('ger bilder för borttagna glögger, inte för dem som är kvar', () => {
    const draft = toDraft(saved, 'demo')
    expect(unusedImages(saved, draft)).toEqual([])
    draft.gloggs.vanlig = draft.gloggs.vanlig.filter((g) => g.gId !== 'gx')
    expect(unusedImages(saved, draft)).toEqual(['i1'])
  })
})

describe('move', () => {
  it('flyttar upp och ned men inte utanför listan', () => {
    expect(move(['a', 'b', 'c'], 1, -1)).toEqual(['b', 'a', 'c'])
    expect(move(['a', 'b', 'c'], 1, 1)).toEqual(['a', 'c', 'b'])
    expect(move(['a', 'b'], 0, -1)).toEqual(['a', 'b'])
    expect(move(['a', 'b'], 1, 1)).toEqual(['a', 'b'])
  })
})
