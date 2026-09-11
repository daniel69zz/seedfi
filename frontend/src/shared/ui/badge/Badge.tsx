import type { LucideIcon } from 'lucide-react'
import type { PropsWithChildren } from 'react'
import './Badge.css'

interface BadgeProps extends PropsWithChildren {
  tone?: 'mint' | 'peach' | 'lavender' | 'blue' | 'pink' | 'emerald'
  icon: LucideIcon
}

export function Badge({ children, tone = 'mint', icon: Icon }: BadgeProps) {
  return (
    <span className={`badge badge--${tone}`}>
      <Icon size={20} strokeWidth={2.7} aria-hidden="true" />
      {children}
    </span>
  )
}
