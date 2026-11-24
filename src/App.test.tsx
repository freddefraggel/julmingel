import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import App from './App'

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
