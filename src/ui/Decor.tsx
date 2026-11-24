// Dekor från designcanvasen: ljusslinga överst och snö som faller. Bara utsmyckning.

const BULB_COLORS = ['var(--color-gold)', 'var(--color-red)', 'var(--color-green)', 'var(--color-text)']

/** Ljusslinga längs sidans överkant. */
export function Garland() {
  const bulbs = Array.from({ length: 12 }, (_, i) => ({
    cx: 16 + i * 32.5,
    cy: [16.4, 20, 16.5][i % 3],
    fill: BULB_COLORS[i % BULB_COLORS.length],
  }))
  return (
    <div className="garland" aria-hidden="true">
      <svg viewBox="0 0 390 36" preserveAspectRatio="none">
        <path d="M0 6Q48.75 22 97.5 6T195 6T292.5 6T390 6" fill="none" stroke="var(--color-text-faint)" strokeWidth="1.5" />
        <g className="garland__bulbs">
          {bulbs.map((b) => (
            <ellipse key={b.cx} cx={b.cx} cy={b.cy} rx="4" ry="5.5" fill={b.fill} />
          ))}
        </g>
      </svg>
    </div>
  )
}

const FLAKES = [
  { left: 6, size: 4, duration: 11, delay: -2 },
  { left: 18, size: 3, duration: 14, delay: -7 },
  { left: 31, size: 5, duration: 12, delay: -4 },
  { left: 44, size: 3, duration: 16, delay: -10 },
  { left: 57, size: 4, duration: 13, delay: -1 },
  { left: 69, size: 3, duration: 15, delay: -8 },
  { left: 80, size: 5, duration: 12, delay: -5 },
  { left: 91, size: 3, duration: 14, delay: -12 },
]

/** Snöflingor som faller över sidan. Stängs av med prefers-reduced-motion. */
export function Snow() {
  return (
    <div className="snow" aria-hidden="true">
      {FLAKES.map((f) => (
        <span
          key={f.left}
          className="snow__flake"
          style={{
            left: `${f.left}%`,
            width: f.size,
            height: f.size,
            animationDuration: `${f.duration}s`,
            animationDelay: `${f.delay}s`,
          }}
        />
      ))}
    </div>
  )
}
