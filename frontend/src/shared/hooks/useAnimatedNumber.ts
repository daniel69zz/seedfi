import { useEffect, useState, useSyncExternalStore } from 'react'

export interface AnimatedNumberOptions {
  from?: number
  to: number
  duration?: number
  delay?: number
}

function prefersReducedMotion() {
  return typeof window !== 'undefined' && typeof window.matchMedia === 'function'
    ? window.matchMedia('(prefers-reduced-motion: reduce)').matches
    : false
}

function subscribeReducedMotion(onChange: () => void) {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return () => {}
  const query = window.matchMedia('(prefers-reduced-motion: reduce)')
  query.addEventListener('change', onChange)
  return () => query.removeEventListener('change', onChange)
}

export function useAnimatedNumber({ from = 0, to, duration = 1200, delay = 0 }: AnimatedNumberOptions) {
  const initial = Number.isFinite(from) ? from : 0
  const target = Number.isFinite(to) ? to : initial
  const milliseconds = Number.isFinite(duration) ? Math.max(0, duration) : 1200
  const wait = Number.isFinite(delay) ? Math.max(0, delay) : 0
  const reducedMotion = useSyncExternalStore(subscribeReducedMotion, prefersReducedMotion, () => false)
  const [animation, setAnimation] = useState({ initial, target, milliseconds, wait, reducedMotion, value: initial })

  useEffect(() => {
    const options = { initial, target, milliseconds, wait, reducedMotion }
    if (reducedMotion || milliseconds === 0 || initial === target) return

    const startsAt = performance.now() + wait
    let frame = 0
    const update = (now: number) => {
      const elapsed = Math.min(1, Math.max(0, (now - startsAt) / milliseconds))
      const eased = 1 - (1 - elapsed) ** 3
      setAnimation({ ...options, value: elapsed === 1 ? target : initial + (target - initial) * eased })
      if (elapsed < 1) frame = window.requestAnimationFrame(update)
    }
    frame = window.requestAnimationFrame(update)
    return () => window.cancelAnimationFrame(frame)
  }, [initial, target, milliseconds, wait, reducedMotion])

  const current = animation.initial === initial && animation.target === target
    && animation.milliseconds === milliseconds && animation.wait === wait && animation.reducedMotion === reducedMotion
  if (!current) setAnimation({ initial, target, milliseconds, wait, reducedMotion, value: initial })
  if (reducedMotion || milliseconds === 0 || initial === target) return target
  return current ? animation.value : initial
}
