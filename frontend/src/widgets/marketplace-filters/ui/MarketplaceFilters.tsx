import { BadgeCheck, Building2, CalendarDays, CircleDollarSign, LayoutGrid, ListFilter, MapPin, Percent, ShieldCheck, TrendingUp } from 'lucide-react'
import type { OpportunityFilters, SetOpportunityFilter } from '../../../features/filter-opportunities/model/useOpportunityFilters'
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
  advancedOpen: boolean
}

const categoryOptions: SelectOption<OpportunityFilters['category']>[] = [{ value: 'all', label: 'Todas las categorías' }, ...categories.map((category) => ({ value: category, label: category }))]
const riskOptions: SelectOption<OpportunityFilters['risk']>[] = [{ value: 'all', label: 'Todos los riesgos' }, { value: 'low', label: 'Riesgo bajo' }, { value: 'medium', label: 'Riesgo medio' }, { value: 'high', label: 'Riesgo alto' }]
const durationOptions: SelectOption<OpportunityFilters['duration']>[] = [{ value: 'all', label: 'Todas las duraciones' }, { value: 'short', label: '≤ 12 meses' }, { value: 'medium', label: '13–24 meses' }, { value: 'long', label: '> 24 meses' }]
const sortOptions: SelectOption<OpportunitySort>[] = [{ value: 'recommended', label: 'Ordenar: Recomendado' }, { value: 'return-desc', label: 'Mayor retorno total' }, { value: 'return-asc', label: 'Menor retorno total' }, { value: 'funding-desc', label: 'Mayor financiación' }, { value: 'duration-asc', label: 'Menor duración' }, { value: 'funded-desc', label: 'Mayor % financiado' }]
const projectOptions: SelectOption<string>[] = [{ value: 'all', label: 'Todos los tipos' }, { value: 'Proyecto residencial', label: 'Proyecto residencial' }, { value: 'Condominio multifamiliar', label: 'Condominio' }, { value: 'Vivienda sostenible', label: 'Vivienda sostenible' }, { value: 'Proyecto comercial', label: 'Proyecto comercial' }, { value: 'Expansión empresarial', label: 'Expansión empresarial' }, { value: 'Capital de trabajo', label: 'Capital de trabajo' }, { value: 'Ampliación de infraestructura', label: 'Ampliación' }, { value: 'Renovación de flota', label: 'Renovación de flota' }]
const returnOptions: SelectOption<OpportunityFilters['returnRange']>[] = [{ value: 'all', label: 'Cualquier retorno' }, { value: 'under-10', label: 'Menos de 10%' }, { value: '10-12', label: '10% a 12%' }, { value: 'over-12', label: 'Más de 12%' }]
const amountOptions: SelectOption<OpportunityFilters['amount']>[] = [{ value: 'all', label: 'Cualquier monto' }, { value: 'under-250', label: 'Menos de 250k' }, { value: '250-500', label: '250k a 500k' }, { value: 'over-500', label: 'Más de 500k' }]
const fundingOptions: SelectOption<OpportunityFilters['funding']>[] = [{ value: 'all', label: 'Cualquier progreso' }, { value: 'under-50', label: 'Menos de 50%' }, { value: '50-75', label: '50% a 75%' }, { value: 'over-75', label: 'Más de 75%' }]
const locationOptions: SelectOption<string>[] = [{ value: 'all', label: 'Toda Bolivia' }, { value: 'La Paz', label: 'La Paz' }, { value: 'Cochabamba', label: 'Cochabamba' }, { value: 'Santa Cruz', label: 'Santa Cruz' }, { value: 'Oruro', label: 'Oruro' }, { value: 'Potosí', label: 'Potosí' }, { value: 'El Alto', label: 'El Alto' }]
const verificationOptions: SelectOption<OpportunityFilters['verification']>[] = [{ value: 'all', label: 'Cualquier verificación' }, { value: 'verified', label: 'Solo verificadas' }, { value: 'unverified', label: 'Aún no verificadas' }]

export function MarketplaceFilters({ filters, onFilterChange, sort, onSortChange, advancedOpen }: MarketplaceFiltersProps) {
  return (
    <div className="marketplace-filters" aria-label="Filtros de oportunidades">
      <div className="marketplace-filters__primary">
        <Select label="Categoría" value={filters.category} onChange={(value) => onFilterChange('category', value)} options={categoryOptions} icon={LayoutGrid} />
        <Select label="Nivel de riesgo" value={filters.risk} onChange={(value) => onFilterChange('risk', value)} options={riskOptions} icon={ShieldCheck} className="marketplace-filters__risk" />
        <Select label="Duración" value={filters.duration} onChange={(value) => onFilterChange('duration', value)} options={durationOptions} icon={CalendarDays} />
        <Select label="Ordenar oportunidades" value={sort} onChange={onSortChange} options={sortOptions} icon={ListFilter} />
      </div>
      {advancedOpen && (
        <div className="marketplace-filters__advanced">
          <Select label="Tipo de proyecto" value={filters.projectType} onChange={(value) => onFilterChange('projectType', value)} options={projectOptions} icon={Building2} />
          <Select label="Retorno" value={filters.returnRange} onChange={(value) => onFilterChange('returnRange', value)} options={returnOptions} icon={TrendingUp} />
          <Select label="Monto" value={filters.amount} onChange={(value) => onFilterChange('amount', value)} options={amountOptions} icon={CircleDollarSign} />
          <Select label="Financiación" value={filters.funding} onChange={(value) => onFilterChange('funding', value)} options={fundingOptions} icon={Percent} />
          <Select label="Ubicación" value={filters.location} onChange={(value) => onFilterChange('location', value)} options={locationOptions} icon={MapPin} />
          <Select label="Verificación" value={filters.verification} onChange={(value) => onFilterChange('verification', value)} options={verificationOptions} icon={BadgeCheck} />
        </div>
      )}
    </div>
  )
}
