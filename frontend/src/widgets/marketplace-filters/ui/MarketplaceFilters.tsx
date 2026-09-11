import { CalendarDays, LayoutGrid, ListFilter, ShieldCheck } from 'lucide-react'
import type {
  OpportunityFilters,
  SetOpportunityFilter,
} from '../../../features/filter-opportunities/model/useOpportunityFilters'
import type { OpportunitySort } from '../../../features/sort-opportunities/model/useOpportunitySort'
import { categories } from '../../../shared/constants/categories'
import { Select } from '../../../shared/ui/select/Select'
import type { SelectOption } from '../../../shared/ui/select/Select'
import './MarketplaceFilters.css'

interface MarketplaceFiltersProps {
  filters: OpportunityFilters
  onFilterChange: SetOpportunityFilter
  sort: OpportunitySort
  onSortChange: (value: OpportunitySort) => void
}

const categoryOptions: SelectOption<OpportunityFilters['category']>[] = [
  { value: 'all', label: 'All Categories' },
  ...categories.map((category) => ({ value: category, label: category })),
]

const riskOptions: SelectOption<OpportunityFilters['risk']>[] = [
  { value: 'all', label: 'All Risk Levels' },
  { value: 'low', label: 'Low Risk' },
  { value: 'medium', label: 'Medium Risk' },
  { value: 'high', label: 'High Risk' },
]

const durationOptions: SelectOption<OpportunityFilters['duration']>[] = [
  { value: 'all', label: 'All Durations' },
  { value: 'short', label: '≤ 12 months' },
  { value: 'medium', label: '13–24 months' },
  { value: 'long', label: '> 24 months' },
]

const sortOptions: SelectOption<OpportunitySort>[] = [
  { value: 'recommended', label: 'Sort by: Recommended' },
  { value: 'apy-desc', label: 'Sort by: Highest APY' },
  { value: 'apy-asc', label: 'Sort by: Lowest APY' },
  { value: 'funding-desc', label: 'Sort by: Highest Funding' },
  { value: 'duration-asc', label: 'Sort by: Shortest Duration' },
]

export function MarketplaceFilters({
  filters,
  onFilterChange,
  sort,
  onSortChange,
}: MarketplaceFiltersProps) {
  return (
    <div className="marketplace-filters" role="group" aria-label="Filter and sort opportunities">
      <Select
        label="Category"
        value={filters.category}
        onChange={(value) => onFilterChange('category', value)}
        options={categoryOptions}
        icon={LayoutGrid}
      />
      <Select
        label="Risk level"
        value={filters.risk}
        onChange={(value) => onFilterChange('risk', value)}
        options={riskOptions}
        icon={ShieldCheck}
        className="marketplace-filters__risk"
      />
      <Select
        label="Duration"
        value={filters.duration}
        onChange={(value) => onFilterChange('duration', value)}
        options={durationOptions}
        icon={CalendarDays}
      />
      <Select
        label="Sort opportunities"
        value={sort}
        onChange={onSortChange}
        options={sortOptions}
        icon={ListFilter}
      />
    </div>
  )
}
