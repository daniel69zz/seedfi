import { useMemo, useState } from 'react'
import type { Opportunity, OpportunityCategory, RiskLevel } from '../../../entities/opportunity/model/opportunity.types'

export type DurationFilter = 'all' | 'short' | 'medium' | 'long'
export type ReturnFilter = 'all' | 'under-10' | '10-12' | 'over-12'
export type AmountFilter = 'all' | 'under-250' | '250-500' | 'over-500'
export type FundingFilter = 'all' | 'under-50' | '50-75' | 'over-75'
export type VerificationFilter = 'all' | 'verified' | 'unverified'

export interface OpportunityFilters {
  search: string
  category: OpportunityCategory | 'all'
  projectType: string
  risk: RiskLevel | 'all'
  duration: DurationFilter
  returnRange: ReturnFilter
  amount: AmountFilter
  funding: FundingFilter
  location: string
  verification: VerificationFilter
}

export type SetOpportunityFilter = <Key extends keyof OpportunityFilters>(key: Key, value: OpportunityFilters[Key]) => void

const initialFilters: OpportunityFilters = {
  search: '', category: 'all', projectType: 'all', risk: 'all', duration: 'all', returnRange: 'all', amount: 'all', funding: 'all', location: 'all', verification: 'all',
}

export function useOpportunityFilters(opportunities: readonly Opportunity[]) {
  const [filters, setFilters] = useState<OpportunityFilters>(initialFilters)
  const setFilter: SetOpportunityFilter = (key, value) => setFilters((current) => ({ ...current, [key]: value }))
  const resetFilters = () => setFilters(initialFilters)

  const filteredOpportunities = useMemo(() => opportunities.filter((opportunity) => {
    const search = filters.search.trim().toLocaleLowerCase('es')
    if (search && ![opportunity.projectName, opportunity.business.name, opportunity.description, opportunity.location].some((value) => value.toLocaleLowerCase('es').includes(search))) return false
    if (filters.category !== 'all' && opportunity.category !== filters.category) return false
    if (filters.projectType !== 'all' && opportunity.projectType !== filters.projectType) return false
    if (filters.risk !== 'all' && opportunity.risk !== filters.risk) return false
    if (filters.location !== 'all' && !opportunity.location.startsWith(filters.location)) return false
    if (filters.verification === 'verified' && !opportunity.verified) return false
    if (filters.verification === 'unverified' && opportunity.verified) return false
    if (filters.duration === 'short' && opportunity.durationMonths > 12) return false
    if (filters.duration === 'medium' && (opportunity.durationMonths <= 12 || opportunity.durationMonths > 24)) return false
    if (filters.duration === 'long' && opportunity.durationMonths <= 24) return false
    if (filters.returnRange === 'under-10' && opportunity.expectedApy >= 10) return false
    if (filters.returnRange === '10-12' && (opportunity.expectedApy < 10 || opportunity.expectedApy > 12)) return false
    if (filters.returnRange === 'over-12' && opportunity.expectedApy <= 12) return false
    if (filters.amount === 'under-250' && opportunity.fundingRequested >= 250000) return false
    if (filters.amount === '250-500' && (opportunity.fundingRequested < 250000 || opportunity.fundingRequested > 500000)) return false
    if (filters.amount === 'over-500' && opportunity.fundingRequested <= 500000) return false
    if (filters.funding === 'under-50' && opportunity.fundedPercentage >= 50) return false
    if (filters.funding === '50-75' && (opportunity.fundedPercentage < 50 || opportunity.fundedPercentage > 75)) return false
    if (filters.funding === 'over-75' && opportunity.fundedPercentage <= 75) return false
    return true
  }), [opportunities, filters])

  const activeFilterCount = Object.entries(filters).filter(([key, value]) => key !== 'search' && value !== 'all').length
  return { filters, setFilter, resetFilters, filteredOpportunities, activeFilterCount }
}
