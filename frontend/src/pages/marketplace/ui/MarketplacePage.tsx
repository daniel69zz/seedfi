import { useMemo, useState } from 'react'
import { ListFilter, RotateCcw, Search } from 'lucide-react'
import { MarketplaceHero } from '../../../widgets/marketplace-hero/ui/MarketplaceHero'
import { MarketplaceFilters } from '../../../widgets/marketplace-filters/ui/MarketplaceFilters'
import { OpportunitiesGrid } from '../../../widgets/opportunities-grid/ui/OpportunitiesGrid'
import { useOpportunityFilters } from '../../../features/filter-opportunities/model/useOpportunityFilters'
import { useOpportunitySort } from '../../../features/sort-opportunities/model/useOpportunitySort'
import { opportunities } from '../../../shared/data/opportunities.mock'
import { proposalToOpportunity } from '../../../shared/data/proposalToOpportunity'
import { useDemo } from '../../../features/demo/model/DemoContext'
import { Button } from '../../../shared/ui/button/Button'
import './MarketplacePage.css'

export function MarketplacePage() {
  const { proposals } = useDemo()
  const [advancedOpen, setAdvancedOpen] = useState(false)
  const marketplaceOpportunities = useMemo(() => [
    ...opportunities,
    ...proposals.filter((proposal) => proposal.status === 'PUBLISHED').map(proposalToOpportunity),
  ], [proposals])
  const { filters, setFilter, resetFilters, filteredOpportunities, activeFilterCount } = useOpportunityFilters(marketplaceOpportunities)
  const { sort, setSort, sortedOpportunities } = useOpportunitySort(filteredOpportunities)

  return (
    <main id="main-content" className="marketplace-page page-shell">
      <div className="marketplace-intro">
        <MarketplaceHero />
        <div className="marketplace-toolbar">
          <label className="marketplace-search">
            <Search size={20} aria-hidden="true" />
            <span className="sr-only">Buscar oportunidades</span>
            <input value={filters.search} onChange={(event) => setFilter('search', event.target.value)} placeholder="Buscar proyecto, empresa o ciudad..." />
          </label>
          <p><strong>{sortedOpportunities.length}</strong> oportunidades encontradas</p>
          <Button variant="secondary" onClick={() => setAdvancedOpen((current) => !current)} aria-expanded={advancedOpen}>
            <ListFilter size={18} /> Filtros {activeFilterCount > 0 && <span className="marketplace-toolbar__count">{activeFilterCount}</span>}
          </Button>
          {(activeFilterCount > 0 || filters.search) && <button className="marketplace-reset" type="button" onClick={resetFilters}><RotateCcw size={16} /> Limpiar</button>}
        </div>
        <div id="opportunities" className="marketplace-controls" tabIndex={-1}>
          <MarketplaceFilters filters={filters} onFilterChange={setFilter} sort={sort} onSortChange={setSort} advancedOpen={advancedOpen} />
        </div>
      </div>
      <OpportunitiesGrid opportunities={sortedOpportunities} onResetFilters={resetFilters} />
    </main>
  )
}
