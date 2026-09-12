import type { LucideIcon } from 'lucide-react'
import { useAnimatedNumber } from '../../../shared/hooks/useAnimatedNumber'
import { formatUsd } from '../../../shared/lib/format'
import { MetricCard } from '../../../shared/ui/platform/PlatformUI'

interface AnimatedMetricProps {
  label: string
  value: number
  icon: LucideIcon
  tone?: 'mint' | 'blue' | 'peach' | 'lavender'
  duration?: number
  delay?: number
}

export function AnimatedMetric({ label, value, icon, tone, duration = 1200, delay = 140 }: AnimatedMetricProps) {
  const animatedValue = useAnimatedNumber({ to: value, duration, delay })
  return (
    <div className="animated-metric">
      <span className="sr-only">{label}: {formatUsd(value, true)}</span>
      <div aria-hidden="true"><MetricCard label={label} value={formatUsd(animatedValue, true)} icon={icon} tone={tone} /></div>
    </div>
  )
}
