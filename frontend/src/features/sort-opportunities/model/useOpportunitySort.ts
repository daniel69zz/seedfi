import { useMemo, useState } from 'react'
import { totalReturnPct } from '../../../entities/opportunity/model/opportunity.types'
import type { Opportunity } from '../../../entities/opportunity/model/opportunity.types'

export type OpportunitySort =
  | 'recommended'
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
      case 'return-desc':
        return sorted.sort((first, second) => totalReturnPct(second) - totalReturnPct(first))
      case 'return-asc':
        return sorted.sort((first, second) => totalReturnPct(first) - totalReturnPct(second))
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
