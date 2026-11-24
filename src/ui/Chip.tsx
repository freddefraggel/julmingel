import type { HTMLAttributes } from 'react'

type Props = HTMLAttributes<HTMLSpanElement> & {
  tone?: 'default' | 'rose' | 'gold' | 'green'
}

/** Liten etikett, t.ex. ”Startar snart”, ”lågt = bra” eller ett gästnamn. */
export function Chip({ tone = 'default', className, ...rest }: Props) {
  const classes = ['chip']
  if (tone !== 'default') classes.push(`chip--${tone}`)
  if (className) classes.push(className)
  return <span className={classes.join(' ')} {...rest} />
}
