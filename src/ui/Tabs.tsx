import { useRef, type KeyboardEvent, type ReactNode } from 'react'

export type TabOption<T extends string> = { value: T; label: ReactNode }

type Props<T extends string> = {
  label: string
  options: readonly TabOption<T>[]
  value: T
  onChange: (value: T) => void
}

/** Flikrad, t.ex. Vanlig/Alkoholfri. Piltangenterna flyttar mellan flikarna. */
export function Tabs<T extends string>({ label, options, value, onChange }: Props<T>) {
  const refs = useRef<(HTMLButtonElement | null)[]>([])

  function onKeyDown(event: KeyboardEvent, index: number) {
    const step = event.key === 'ArrowRight' ? 1 : event.key === 'ArrowLeft' ? -1 : 0
    if (step === 0) return
    event.preventDefault()
    const next = (index + step + options.length) % options.length
    const option = options[next]
    if (!option) return
    onChange(option.value)
    refs.current[next]?.focus()
  }

  return (
    <div role="tablist" aria-label={label} className="tabs">
      {options.map((option, index) => {
        const selected = option.value === value
        return (
          <button
            key={option.value}
            ref={(el) => {
              refs.current[index] = el
            }}
            type="button"
            role="tab"
            aria-selected={selected}
            tabIndex={selected ? 0 : -1}
            className="tabs__tab"
            onClick={() => onChange(option.value)}
            onKeyDown={(event) => onKeyDown(event, index)}
          >
            {option.label}
          </button>
        )
      })}
    </div>
  )
}
