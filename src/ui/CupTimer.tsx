type Props = {
  /** Sekunder kvar. 0 eller mindre betyder att tiden är ute. */
  secondsLeft: number
  /** Frågans hela tid i sekunder. */
  totalSeconds: number
}

const CUP_DEPTH = 32 // höjden på vätskan när koppen är full, i viewBox-enheter
const CUP_BOTTOM = 46

/**
 * Glöggkopp som töms i takt med att tiden går. Bara visning: nedräkningen mot
 * serverns tid görs av den som använder komponenten (#16).
 */
export function CupTimer({ secondsLeft, totalSeconds }: Props) {
  const left = Math.max(0, Math.ceil(secondsLeft))
  const fraction = totalSeconds > 0 ? Math.min(1, Math.max(0, secondsLeft / totalSeconds)) : 0
  const liquidHeight = Math.round(CUP_DEPTH * fraction * 10) / 10
  const steaming = fraction > 2 / 3
  const low = left > 0 && left <= 5

  return (
    <div className={low ? 'cup-timer cup-timer--low' : 'cup-timer'}>
      <span className="cup-timer__label" aria-hidden="true">
        {left > 0 ? `${left} s` : 'Tiden ute!'}
      </span>
      <svg role="img" aria-label={left > 0 ? `${left} sekunder kvar` : 'Tiden är ute'} width="48" height="56" viewBox="0 0 48 56">
        <path
          className="cup-timer__steam"
          d="M15 3c-1.5 2 1.5 3 0 5M21 3c-1.5 2 1.5 3 0 5M27 3c-1.5 2 1.5 3 0 5"
          style={{ opacity: steaming ? 1 : 0 }}
        />
        <rect className="cup-timer__liquid" x="10" y={CUP_BOTTOM - liquidHeight} width="22" height={liquidHeight} rx="5" />
        <path className="cup-timer__outline" d="M8 12h26v28a8 8 0 0 1-8 8H16a8 8 0 0 1-8-8z" />
        <path className="cup-timer__outline" d="M34 19h3a6 6 0 0 1 0 12h-3" />
      </svg>
    </div>
  )
}
