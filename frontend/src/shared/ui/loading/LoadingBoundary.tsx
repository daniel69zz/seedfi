import type { PropsWithChildren } from 'react'
import { useLoadingVisibility } from '../../hooks/useLoadingVisibility'
import { LoadingScreen } from './LoadingScreen'

interface LoadingBoundaryProps extends PropsWithChildren {
  isLoading: boolean
  message?: string
  showDelay?: number
  minimumVisibleTime?: number
}

export function LoadingBoundary({ isLoading, message, showDelay, minimumVisibleTime, children }: LoadingBoundaryProps) {
  const { showLoader, isPending } = useLoadingVisibility(isLoading, { showDelay, minimumVisibleTime })
  return isPending ? <LoadingScreen message={message} visible={showLoader} /> : children
}
