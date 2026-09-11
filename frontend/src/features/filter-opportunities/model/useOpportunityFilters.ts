import { useMemo, useState } from 'react'
import type {
  Opportunity,
  OpportunityCategory,
  Risk,
} from '../../../entities/opportunity/model/opportunity.types'

export type DurationFilter = 'all' | 'short' | 'medium' | 'long'

export interface OpportunityFilters {
  category: OpportunityCategory | 'all'
  risk: Risk | 'all'
  duration: DurationFilter
}

export type SetOpportunityFilter = <Key extends keyof OpportunityFilters>(
  key: Key,
  value: OpportunityFilters[Key],
) => void

const initialFilters: OpportunityFilters = {
  category: 'all',
  risk: 'all',
  duration: 'all',
}

export function useOpportunityFilters(opportunities: readonly Opportunity[]) {
  const [filters, setFilters] = useState<OpportunityFilters>(initialFilters)

  const setFilter: SetOpportunityFilter = (key, value) => {
    setFilters((current) => ({ ...current, [key]: value }))
  }

  const resetFilters = () => setFilters(initialFilters)

  const filteredOpportunities = useMemo(
    () => opportunities.filter((opportunity) => {
      if (filters.category !== 'all' && opportunity.category !== filters.category) {
        return false
      }

      if (filters.risk !== 'all' && opportunity.risk !== filters.risk) {
        return false
      }

      switch (filters.duration) {
        case 'short':
          return opportunity.durationMonths <= 12
        case 'medium':
          return opportunity.durationMonths > 12 && opportunity.durationMonths <= 24
        case 'long':
          return opportunity.durationMonths > 24
        default:
          return true
      }
    }),
    [opportunities, filters],
  )

  return { filters, setFilter, resetFilters, filteredOpportunities }
}
