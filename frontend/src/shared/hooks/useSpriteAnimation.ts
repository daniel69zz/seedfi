import { useEffect, useState } from 'react'
import { usePrefersReducedMotion } from './usePrefersReducedMotion'

interface SpriteAnimationOptions {
  totalFrames: number
  frameDuration?: number
  loop?: boolean
  enabled?: boolean
  reducedMotionFrame?: number
}

export function useSpriteAnimation({ totalFrames, frameDuration = 90, loop = true, enabled = true, reducedMotionFrame = 0 }: SpriteAnimationOptions) {
  const count = Number.isFinite(totalFrames) ? Math.max(1, Math.floor(totalFrames)) : 1
  const duration = Number.isFinite(frameDuration) ? Math.max(16, frameDuration) : 90
  const reducedMotion = usePrefersReducedMotion()
  const key = `${count}:${duration}:${loop}:${enabled}:${reducedMotion}`
  const [state, setState] = useState({ key, frame: 0 })

  useEffect(() => {
    if (!enabled || reducedMotion || count === 1) return
    let request = 0
    let lastFrame = 0
    const start = performance.now()
    function tick(now: number) {
      const elapsedFrame = Math.floor((now - start) / duration)
      const frame = loop ? elapsedFrame % count : Math.min(elapsedFrame, count - 1)
      if (frame !== lastFrame) {
        lastFrame = frame
        setState({ key, frame })
      }
      if (loop || frame < count - 1) request = window.requestAnimationFrame(tick)
    }
    request = window.requestAnimationFrame(tick)
    return () => window.cancelAnimationFrame(request)
  }, [count, duration, loop, enabled, reducedMotion, key])

  if (state.key !== key) setState({ key, frame: 0 })
  const staticFrame = Number.isFinite(reducedMotionFrame) ? Math.max(0, Math.min(count - 1, Math.floor(reducedMotionFrame))) : 0
  return {
    currentFrame: reducedMotion ? staticFrame : state.key === key ? state.frame : 0,
    reducedMotion,
  }
}
