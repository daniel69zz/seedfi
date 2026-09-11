import type { Opportunity } from '../model/opportunity.types'
import './OpportunityStats.css'

interface OpportunityStatsProps {
  opportunity: Opportunity
}

const currencyFormatter = new Intl.NumberFormat('en-US', {
  maximumFractionDigits: 0,
})

export function OpportunityStats({ opportunity }: OpportunityStatsProps) {
  return (
    <dl className="opportunity-stats">
      <div>
        <dd>${currencyFormatter.format(opportunity.fundingRequested)}</dd>
        <dt>Monto solicitado</dt>
      </div>
      <div>
        <dd>{opportunity.expectedApy}%</dd>
        <dt>APY estimado</dt>
      </div>
      <div>
        <dd>{opportunity.durationMonths} meses</dd>
        <dt>Duración</dt>
      </div>
    </dl>
  )
}
