const STAR = 'M12 3l2.6 5.6 6 .7-4.5 4.1 1.2 6L12 16.4 6.7 19.4l1.2-6L3.4 9.3l6-.7z'

type Props = {
  /** Antal tända stjärnor, 0–max. */
  count: number
  max?: number
  size?: number
  /** Skärmläsartext. Standard: ”2 av 3 snabbhetsstjärnor kvar”. */
  label?: string
}

export function Stars({ count, max = 3, size = 28, label }: Props) {
  const lit = Math.max(0, Math.min(max, Math.round(count)))
  return (
    <div role="img" aria-label={label ?? `${lit} av ${max} snabbhetsstjärnor kvar`} className="stars">
      {Array.from({ length: max }, (_, i) => (
        <svg
          key={i}
          aria-hidden="true"
          width={size}
          height={size}
          viewBox="0 0 24 24"
          className={i < lit ? 'stars__star stars__star--on' : 'stars__star'}
        >
          <path d={STAR} strokeWidth="1.6" strokeLinejoin="round" />
        </svg>
      ))}
    </div>
  )
}
