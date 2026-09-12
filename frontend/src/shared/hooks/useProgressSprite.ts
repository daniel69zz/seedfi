import { useEffect, useRef, useState } from 'react'
import { usePrefersReducedMotion } from './usePrefersReducedMotion'

interface ProgressSpriteOptions {
  progress: number
  totalFrames: number
  duration?: number
  delay?: number
  enabled?: boolean
}

export function useProgressSprite({
  progress,
  totalFrames,
  duration = 1600,
  delay = 140,
  enabled = true,
}: ProgressSpriteOptions) {
  const count = Number.isFinite(totalFrames) ? Math.max(1, Math.floor(totalFrames)) : 1
  const normalizedProgress = Number.isFinite(progress) ? Math.min(100, Math.max(0, progress)) : 0
  const targetFrame = Math.round((normalizedProgress / 100) * (count - 1))
  const animationDuration = Number.isFinite(duration) ? Math.max(0, duration) : 1600
  const animationDelay = Number.isFinite(delay) ? Math.max(0, delay) : 140
  const reducedMotion = usePrefersReducedMotion()
  const [frame, setFrame] = useState(reducedMotion ? targetFrame : 0)
  const frameRef = useRef(frame)

  useEffect(() => {
    if (reducedMotion || animationDuration === 0 || frameRef.current > targetFrame) {
      frameRef.current = targetFrame
      setFrame(targetFrame)
      return
    }

    if (!enabled || frameRef.current === targetFrame) return

    // Advance one frame at a time, even after a slow/backgrounded browser frame.
    const minimumFrameDuration = 32
    // Keep the same growth speed when a live update adds only a few poses;
    // that short continuation should not replay the full entry duration.
    const frameDuration = Math.max(minimumFrameDuration, animationDuration / Math.max(targetFrame, 1))
    let lastFrameAt = performance.now() + animationDelay
    let nextFrameAt = lastFrameAt + frameDuration
    let request = 0
    let cancelled = false

    function tick(now: number) {
      if (cancelled) return

      if (now >= nextFrameAt && now - lastFrameAt >= minimumFrameDuration) {
        frameRef.current += 1
        setFrame(frameRef.current)
        lastFrameAt = now
        // Keep the original schedule so normal rAF rounding does not add up.
        nextFrameAt += frameDuration
      }

      if (frameRef.current < targetFrame) request = window.requestAnimationFrame(tick)
    }

    request = window.requestAnimationFrame(tick)
    return () => {
      cancelled = true
      window.cancelAnimationFrame(request)
    }
  }, [targetFrame, animationDuration, animationDelay, enabled, reducedMotion])

  return {
    currentFrame: reducedMotion || animationDuration === 0 ? targetFrame : Math.min(frame, targetFrame),
    targetFrame,
  }
}
