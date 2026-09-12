import { useMemo, useState } from 'react'
import type { Opportunity } from '../../../entities/opportunity/model/opportunity.types'

export type OpportunitySort =
  | 'recommended'
  | 'apy-desc'
  | 'apy-asc'
  | 'return-desc'
  | 'return-asc'
  | 'funding-desc'
  | 'duration-asc'
  | 'funded-desc'

export function useOpportunitySort(opportunities: readonly Opportunity[]) {
  const [sort, setSort] = useState<OpportunitySort>('recommended')

  const sortedOpportunities = useMemo(() => {
    const sorted = [...opportunities]

    switch (sort) {
      case 'apy-desc':
        return sorted.sort((first, second) => second.expectedApy - first.expectedApy)
      case 'apy-asc':
        return sorted.sort((first, second) => first.expectedApy - second.expectedApy)
      case 'return-desc':
        return sorted.sort((first, second) => second.totalReturnPct - first.totalReturnPct)
      case 'return-asc':
        return sorted.sort((first, second) => first.totalReturnPct - second.totalReturnPct)
      case 'funding-desc':
        return sorted.sort((first, second) => second.fundedAmount - first.fundedAmount)
      case 'duration-asc':
        return sorted.sort((first, second) => first.durationMonths - second.durationMonths)
      case 'funded-desc':
        return sorted.sort((first, second) => second.fundedPercentage - first.fundedPercentage)
      default:
        return sorted
    }
  }, [opportunities, sort])

  return { sort, setSort, sortedOpportunities }
}
