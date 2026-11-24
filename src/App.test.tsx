import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import App from './App'

// Ingen inloggad användare: admin-sidorna visar inloggningen.
vi.mock('./data', () => ({
  onUserChanged: (callback: (user: null) => void) => {
    callback(null)
    return () => {}
  },
}))

function renderAt(hash: string) {
  localStorage.clear()
  window.location.hash = hash
  render(<App />)
}

afterEach(() => {
  cleanup()
  window.location.hash = ''
})

describe('routing', () => {
  it('visar gästvyn på #/', () => {
    renderAt('#/')
    expect(screen.getByRole('heading', { name: 'Välkommen!' })).toBeInTheDocument()
  })

  it('visar kontrollpanelen på #/admin', () => {
    renderAt('#/admin')
    expect(screen.getByRole('heading', { name: 'Styr kvällen' })).toBeInTheDocument()
  })

  it('visar Förbered kvällen på #/admin/forbered', () => {
    renderAt('#/admin/forbered')
    expect(screen.getByRole('heading', { name: 'Förbered kvällen' })).toBeInTheDocument()
  })

  it('skickar okända adresser till gästvyn', () => {
    renderAt('#/finns-inte')
    expect(screen.getByRole('heading', { name: 'Välkommen!' })).toBeInTheDocument()
  })
})
