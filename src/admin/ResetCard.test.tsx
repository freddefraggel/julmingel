import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import * as data from '../data'
import { resetChanges } from '../live'
import { ResetCard } from './ResetCard'

vi.mock('../data', () => ({ resetEvening: vi.fn() }))

const mocked = vi.mocked(data)

beforeEach(() => {
  vi.clearAllMocks()
  mocked.resetEvening.mockResolvedValue()
})

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
})

describe('Nollställ kvällen', () => {
  it('frågar först, och nollställer utan att ta bort gästerna', async () => {
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(true)
    render(<ResetCard eventId="demo" />)
    fireEvent.click(screen.getByRole('button', { name: 'Nollställ kvällen' }))
    expect(confirm).toHaveBeenCalledWith(expect.stringContaining('Gästerna finns kvar'))
    await waitFor(() => expect(mocked.resetEvening).toHaveBeenCalledWith('demo', false))
    expect(await screen.findByRole('status')).toHaveTextContent('Kvällen är nollställd.')
  })

  it('tar bort gästerna också när admin väljer det', async () => {
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(true)
    render(<ResetCard eventId="demo" />)
    fireEvent.click(screen.getByLabelText('Ta bort gästerna också'))
    fireEvent.click(screen.getByRole('button', { name: 'Nollställ kvällen' }))
    expect(confirm).toHaveBeenCalledWith(expect.stringContaining('alla gäster tas bort'))
    await waitFor(() => expect(mocked.resetEvening).toHaveBeenCalledWith('demo', true))
    expect(await screen.findByRole('status')).toHaveTextContent('och gästerna är borttagna')
  })

  it('gör inget om admin ångrar sig', () => {
    vi.spyOn(window, 'confirm').mockReturnValue(false)
    render(<ResetCard eventId="demo" />)
    fireEvent.click(screen.getByRole('button', { name: 'Nollställ kvällen' }))
    expect(mocked.resetEvening).not.toHaveBeenCalled()
  })

  it('säger till när det inte går', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true)
    mocked.resetEvening.mockRejectedValue(new Error('PERMISSION_DENIED'))
    render(<ResetCard eventId="demo" />)
    fireEvent.click(screen.getByRole('button', { name: 'Nollställ kvällen' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('Kunde inte nollställa kvällen')
  })
})

describe('resetChanges', () => {
  it('tar bort kvällens resultat men inte förberedelserna', () => {
    const changes = resetChanges(false)
    expect(Object.keys(changes).sort()).toEqual(
      ['answers', 'guesses', 'live', 'ratings', 'results', 'reveal', 'secret/leaderboard', 'secret/quizTimes'].sort(),
    )
    expect(Object.values(changes).every((v) => v === null)).toBe(true)
    for (const kept of ['config', 'assets', 'secret', 'secret/joinCode', 'secret/numbers', 'secret/correct', 'guests']) {
      expect(changes).not.toHaveProperty([kept])
    }
  })

  it('tar bort gästerna bara när admin väljer det', () => {
    expect(resetChanges(true)).toHaveProperty(['guests'], null)
  })
})
