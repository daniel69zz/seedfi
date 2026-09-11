import { SearchX } from 'lucide-react'
import type { Opportunity } from '../../../entities/opportunity/model/opportunity.types'
import { OpportunityCard } from '../../../entities/opportunity/ui/OpportunityCard'
import { Button } from '../../../shared/ui/button/Button'
import './OpportunitiesGrid.css'

interface OpportunitiesGridProps {
  opportunities: readonly Opportunity[]
  onResetFilters: () => void
}

export function OpportunitiesGrid({ opportunities, onResetFilters }: OpportunitiesGridProps) {
  if (opportunities.length === 0) {
    return (
      <section className="opportunities-empty" aria-live="polite">
        <SearchX size={35} aria-hidden="true" />
        <h2>No encontramos oportunidades</h2>
        <p>Prueba otra combinación de categoría, riesgo o duración.</p>
        <Button onClick={onResetFilters}>Limpiar filtros</Button>
      </section>
    )
  }

  return (
    <section className="opportunities-grid" aria-label={`${opportunities.length} oportunidades de inversión`}>
      {opportunities.map((opportunity) => (
        <OpportunityCard key={opportunity.id} opportunity={opportunity} />
      ))}
    </section>
  )
}
