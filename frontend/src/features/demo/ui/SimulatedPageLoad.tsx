import { useEffect, useState, type PropsWithChildren } from 'react'
import { LoadingBoundary } from '../../../shared/ui/loading/LoadingBoundary'
import { fakeLoading } from '../../../shared/utils/fakeLoading'

// Demo-only adapter. A real page can pass its request state directly to LoadingBoundary.
export function SimulatedPageLoad({ message, children }: PropsWithChildren<{ message: string }>) {
  const [isLoading, setIsLoading] = useState(true)
  useEffect(() => {
    const controller = new AbortController()
    fakeLoading(undefined, controller.signal).then(
      () => { if (!controller.signal.aborted) setIsLoading(false) },
      () => { if (!controller.signal.aborted) setIsLoading(false) },
    )
    return () => controller.abort()
  }, [])
  return <LoadingBoundary isLoading={isLoading} message={message}>{children}</LoadingBoundary>
}
