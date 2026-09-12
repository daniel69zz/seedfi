import { useEffect, useState } from 'react'
import { useDemo } from '../../../features/demo/model/DemoContext'
import { investmentService } from '../../../shared/api/investmentService'
import type { Investment } from '../../../shared/types/platform.types'
import type { InvestmentDetail } from './investment.types'

interface DetailState {
  id: string | undefined
  source: Investment[]
  investment: InvestmentDetail | null
  isLoading: boolean
  error: string | null
}

export function useInvestmentDetail(id: string | undefined) {
  const { investments } = useDemo()
  const [state, setState] = useState<DetailState>({ id, source: investments, investment: null, isLoading: Boolean(id), error: null })

  useEffect(() => {
    if (!id) return
    const controller = new AbortController()

    investmentService.getById(id, investments, controller.signal).then(
      (investment) => {
        if (!controller.signal.aborted) setState({ id, source: investments, investment, isLoading: false, error: null })
      },
      () => {
        if (!controller.signal.aborted) setState({ id, source: investments, investment: null, isLoading: false, error: 'No pudimos cargar esta inversión. Inténtalo nuevamente.' })
      },
    )

    return () => controller.abort()
  }, [id, investments])

  // Never render the previous route's detail while its replacement is loading.
  if (state.id !== id || state.source !== investments) {
    setState({ id, source: investments, investment: null, isLoading: Boolean(id), error: null })
    return { investment: null, isLoading: Boolean(id), error: null }
  }
  return { investment: state.investment, isLoading: state.isLoading, error: state.error }
}
