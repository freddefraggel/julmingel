import type { HTMLAttributes } from 'react'

type Props = HTMLAttributes<HTMLDivElement> & {
  /** `accent` = guldkort (t.ex. Ranka glögg), `dashed` = låst eller kommande. */
  variant?: 'default' | 'accent' | 'dashed'
  compact?: boolean
}

export function Card({ variant = 'default', compact = false, className, ...rest }: Props) {
  const classes = ['card']
  if (variant !== 'default') classes.push(`card--${variant}`)
  if (compact) classes.push('card--compact')
  if (className) classes.push(className)
  return <div className={classes.join(' ')} {...rest} />
}
