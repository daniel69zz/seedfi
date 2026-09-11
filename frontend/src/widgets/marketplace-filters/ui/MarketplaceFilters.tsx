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
  { value: 'all', label: 'Todas las categorías' },
  ...categories.map((category) => ({ value: category, label: category })),
]

const riskOptions: SelectOption<OpportunityFilters['risk']>[] = [
  { value: 'all', label: 'Todos los riesgos' },
  { value: 'low', label: 'Bajo' },
  { value: 'medium', label: 'Medio' },
  { value: 'high', label: 'Alto' },
]

const durationOptions: SelectOption<OpportunityFilters['duration']>[] = [
  { value: 'all', label: 'Todas las duraciones' },
  { value: 'short', label: '≤ 12 meses' },
  { value: 'medium', label: '13–24 meses' },
  { value: 'long', label: '> 24 meses' },
]

const sortOptions: SelectOption<OpportunitySort>[] = [
  { value: 'recommended', label: 'Ordenar por: Recomendado' },
  { value: 'apy-desc', label: 'Mayor APY' },
  { value: 'apy-asc', label: 'Menor APY' },
  { value: 'funding-desc', label: 'Mayor financiación' },
  { value: 'duration-asc', label: 'Menor duración' },
  { value: 'funded-desc', label: 'Mayor porcentaje financiado' },
]

export function MarketplaceFilters({
  filters,
  onFilterChange,
  sort,
  onSortChange,
}: MarketplaceFiltersProps) {
  return (
    <div className="marketplace-filters" role="group" aria-label="Filtrar y ordenar oportunidades">
      <Select
        label="Categoría"
        value={filters.category}
        onChange={(value) => onFilterChange('category', value)}
        options={categoryOptions}
        icon={LayoutGrid}
      />
      <Select
        label="Nivel de riesgo"
        value={filters.risk}
        onChange={(value) => onFilterChange('risk', value)}
        options={riskOptions}
        icon={ShieldCheck}
        className="marketplace-filters__risk"
      />
      <Select
        label="Duración"
        value={filters.duration}
        onChange={(value) => onFilterChange('duration', value)}
        options={durationOptions}
        icon={CalendarDays}
      />
      <Select
        label="Ordenar oportunidades"
        value={sort}
        onChange={onSortChange}
        options={sortOptions}
        icon={ListFilter}
      />
    </div>
  )
}
