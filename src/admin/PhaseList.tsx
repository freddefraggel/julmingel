import type { Phase } from '../types'
import { PHASES, phaseIndex } from './phases'

type Props = {
  current: Phase | undefined
  disabled: boolean
  onSelect: (phase: Phase) => void
}

/** Kvällens flöde: en knapp per fas. Varje tryck är en skrivning till live/phase. */
export function PhaseList({ current, disabled, onSelect }: Props) {
  const currentIndex = phaseIndex(current)
  return (
    <nav className="phases" aria-labelledby="phases-title">
      <span id="phases-title" className="eyebrow">
        Kvällens flöde
      </span>
      {PHASES.map((info, index) => {
        const state = index === currentIndex ? 'active' : index < currentIndex ? 'done' : 'todo'
        return (
          <button
            key={info.phase}
            type="button"
            className={`phase phase--${state}`}
            aria-current={state === 'active' ? 'step' : undefined}
            disabled={disabled || state === 'active'}
            onClick={() => onSelect(info.phase)}
          >
            <span className="phase__dot" aria-hidden="true">
              {index + 1}
            </span>
            <span className="phase__text">
              <span className="phase__label">{info.label}</span>
              <span className="phase__sub">{info.sub}</span>
            </span>
          </button>
        )
      })}
    </nav>
  )
}
