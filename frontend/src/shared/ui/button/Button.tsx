import type { AnchorHTMLAttributes, ButtonHTMLAttributes, PropsWithChildren } from 'react'
import { Link } from 'react-router-dom'
import { cn } from '../../utils/cn'
import './Button.css'

type CommonProps = PropsWithChildren<{
  className?: string
  to?: string
}>

type ButtonProps = CommonProps & ButtonHTMLAttributes<HTMLButtonElement> & AnchorHTMLAttributes<HTMLAnchorElement>

export function Button({ className, to, children, ...props }: ButtonProps) {
  if (to) {
    return (
      <Link className={cn('button', className)} to={to} {...(props as AnchorHTMLAttributes<HTMLAnchorElement>)}>
        {children}
      </Link>
    )
  }

  return (
    <button className={cn('button', className)} type="button" {...(props as ButtonHTMLAttributes<HTMLButtonElement>)}>
      {children}
    </button>
  )
}
