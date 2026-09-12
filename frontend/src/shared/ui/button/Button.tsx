import type { AnchorHTMLAttributes, ButtonHTMLAttributes, PropsWithChildren } from 'react'
import { Link } from 'react-router-dom'
import { cn } from '../../utils/cn'
import './Button.css'

type CommonProps = PropsWithChildren<{
  className?: string
  to?: string
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger'
}>

type ButtonProps = CommonProps & ButtonHTMLAttributes<HTMLButtonElement> & AnchorHTMLAttributes<HTMLAnchorElement>

export function Button({ className, to, variant = 'primary', children, ...props }: ButtonProps) {
  const buttonClassName = cn('button', `button--${variant}`, className)
  if (to) {
    return (
      <Link className={buttonClassName} to={to} {...(props as AnchorHTMLAttributes<HTMLAnchorElement>)}>
        {children}
      </Link>
    )
  }

  return (
    <button className={buttonClassName} type="button" {...(props as ButtonHTMLAttributes<HTMLButtonElement>)}>
      {children}
    </button>
  )
}
