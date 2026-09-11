import { MarketplaceHero } from '../../../widgets/marketplace-hero/ui/MarketplaceHero'
import { MarketplaceFilters } from '../../../widgets/marketplace-filters/ui/MarketplaceFilters'
import { OpportunitiesGrid } from '../../../widgets/opportunities-grid/ui/OpportunitiesGrid'
import { useOpportunityFilters } from '../../../features/filter-opportunities/model/useOpportunityFilters'
import { useOpportunitySort } from '../../../features/sort-opportunities/model/useOpportunitySort'
import { opportunities } from '../../../shared/data/opportunities.mock'
import './MarketplacePage.css'

export function MarketplacePage() {
  const { filters, setFilter, resetFilters, filteredOpportunities } = useOpportunityFilters(opportunities)
  const { sort, setSort, sortedOpportunities } = useOpportunitySort(filteredOpportunities)

  return (
    <main id="main-content" className="marketplace-page page-shell">
      <div className="marketplace-intro">
        <MarketplaceHero />
        <div id="opportunities" className="marketplace-controls" tabIndex={-1}>
          <MarketplaceFilters filters={filters} onFilterChange={setFilter} sort={sort} onSortChange={setSort} />
        </div>
      </div>
      <OpportunitiesGrid opportunities={sortedOpportunities} onResetFilters={resetFilters} />
    </main>
  )
}
