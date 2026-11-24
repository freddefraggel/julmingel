import type { ButtonHTMLAttributes } from 'react'

type Props = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'primary' | 'secondary'
  size?: 'small' | 'medium' | 'large'
  block?: boolean
}

export function Button({ variant = 'primary', size = 'medium', block = false, className, type = 'button', ...rest }: Props) {
  const classes = ['btn', `btn--${variant}`]
  if (size !== 'medium') classes.push(`btn--${size}`)
  if (block) classes.push('btn--block')
  if (className) classes.push(className)
  return <button type={type} className={classes.join(' ')} {...rest} />
}
