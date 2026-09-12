import { useAnimatedNumber } from './useAnimatedNumber'

export interface AnimatedProgressOptions {
  duration?: number
  delay?: number
}

export function useAnimatedProgress(progress: number, { duration = 1200, delay = 0 }: AnimatedProgressOptions = {}) {
  const target = Number.isFinite(progress) ? Math.min(100, Math.max(0, progress)) : 0
  return useAnimatedNumber({ from: 0, to: target, duration, delay })
}
