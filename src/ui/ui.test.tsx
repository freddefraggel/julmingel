import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { useState } from 'react'
import { afterEach, describe, expect, it } from 'vitest'
import { Button, CupTimer, Stars, Tabs } from './index'

afterEach(cleanup)

describe('Button', () => {
  it('är en vanlig knapp som standard, inte submit', () => {
    render(<Button>Gå med</Button>)
    const button = screen.getByRole('button', { name: 'Gå med' })
    expect(button).toHaveAttribute('type', 'button')
    expect(button).toHaveClass('btn', 'btn--primary')
  })
})

describe('Tabs', () => {
  function ClassTabs() {
    const [value, setValue] = useState<'vanlig' | 'alkfri'>('vanlig')
    return (
      <Tabs
        label="Glöggprovning"
        value={value}
        onChange={setValue}
        options={[
          { value: 'vanlig', label: 'Vanlig' },
          { value: 'alkfri', label: 'Alkoholfri' },
        ]}
      />
    )
  }

  it('markerar vald flik och byter vid klick', () => {
    render(<ClassTabs />)
    expect(screen.getByRole('tab', { name: 'Vanlig' })).toHaveAttribute('aria-selected', 'true')
    fireEvent.click(screen.getByRole('tab', { name: 'Alkoholfri' }))
    expect(screen.getByRole('tab', { name: 'Alkoholfri' })).toHaveAttribute('aria-selected', 'true')
    expect(screen.getByRole('tab', { name: 'Vanlig' })).toHaveAttribute('aria-selected', 'false')
  })

  it('byter flik med piltangenterna', () => {
    render(<ClassTabs />)
    fireEvent.keyDown(screen.getByRole('tab', { name: 'Vanlig' }), { key: 'ArrowRight' })
    const alkfri = screen.getByRole('tab', { name: 'Alkoholfri' })
    expect(alkfri).toHaveAttribute('aria-selected', 'true')
    expect(alkfri).toHaveFocus()
  })
})

describe('Stars', () => {
  it('tänder rätt antal och beskriver det för skärmläsare', () => {
    const { container } = render(<Stars count={2} />)
    expect(screen.getByRole('img', { name: '2 av 3 snabbhetsstjärnor kvar' })).toBeInTheDocument()
    expect(container.querySelectorAll('.stars__star--on')).toHaveLength(2)
  })

  it('håller antalet inom 0–max', () => {
    const { container } = render(<Stars count={7} />)
    expect(container.querySelectorAll('.stars__star--on')).toHaveLength(3)
  })
})

describe('CupTimer', () => {
  it('visar sekunder kvar och fyller koppen i proportion', () => {
    const { container } = render(<CupTimer secondsLeft={15} totalSeconds={30} />)
    expect(screen.getByRole('img', { name: '15 sekunder kvar' })).toBeInTheDocument()
    expect(screen.getByText('15 s')).toBeInTheDocument()
    expect(container.querySelector('.cup-timer__liquid')).toHaveAttribute('height', '16')
  })

  it('varnar de sista fem sekunderna', () => {
    const { container } = render(<CupTimer secondsLeft={4} totalSeconds={30} />)
    expect(container.querySelector('.cup-timer')).toHaveClass('cup-timer--low')
  })

  it('visar att tiden är ute och tömmer koppen', () => {
    const { container } = render(<CupTimer secondsLeft={-2} totalSeconds={30} />)
    expect(screen.getByRole('img', { name: 'Tiden är ute' })).toBeInTheDocument()
    expect(screen.getByText('Tiden ute!')).toBeInTheDocument()
    expect(container.querySelector('.cup-timer__liquid')).toHaveAttribute('height', '0')
  })
})
