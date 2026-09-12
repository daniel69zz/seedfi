import { useEffect, useRef, useState } from 'react'
import { LOADING_TIMING } from '../config/loadingAnimation'

interface LoadingVisibilityOptions {
  showDelay?: number
  minimumVisibleTime?: number
}

export function useLoadingVisibility(isLoading: boolean, { showDelay = LOADING_TIMING.showDelay, minimumVisibleTime = LOADING_TIMING.minimumVisibleTime }: LoadingVisibilityOptions = {}) {
  const [showLoader, setShowLoader] = useState(false)
  const shownAt = useRef<number | null>(null)
  const delay = Number.isFinite(showDelay) ? Math.max(0, showDelay) : LOADING_TIMING.showDelay
  const minimum = Number.isFinite(minimumVisibleTime) ? Math.max(0, minimumVisibleTime) : LOADING_TIMING.minimumVisibleTime

  useEffect(() => {
    let timer: number | undefined
    if (isLoading && !showLoader) {
      timer = window.setTimeout(() => {
        shownAt.current = performance.now()
        setShowLoader(true)
      }, delay)
    } else if (!isLoading && showLoader) {
      const remaining = Math.max(0, minimum - (performance.now() - (shownAt.current ?? performance.now())))
      timer = window.setTimeout(() => {
        shownAt.current = null
        setShowLoader(false)
      }, remaining)
    }
    return () => window.clearTimeout(timer)
  }, [isLoading, showLoader, delay, minimum])

  // Keep the destination unmounted until the loader has completely finished.
  return { showLoader, isPending: isLoading || showLoader }
}
