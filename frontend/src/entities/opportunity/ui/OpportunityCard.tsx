import {
  ArrowRight,
  BadgeCheck,
  Heart,
  House,
  Laptop,
  Leaf,
  ShieldCheck,
  Sprout,
  Truck,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import type { Opportunity, OpportunityCategory, RiskLevel } from '../model/opportunity.types'
import { routes } from '../../../shared/constants/routes'
import { Badge } from '../../../shared/ui/badge/Badge'
import { BusinessImage } from '../../../shared/ui/business-image/BusinessImage'
import { Button } from '../../../shared/ui/button/Button'
import { FundingProgress } from '../../../shared/ui/funding-progress/FundingProgress'
import { OpportunityStats } from './OpportunityStats'
import './OpportunityCard.css'

interface OpportunityCardProps {
  opportunity: Opportunity
}

type BadgeTone = 'mint' | 'peach' | 'lavender' | 'blue' | 'pink'

const categoryPresentation: Record<OpportunityCategory, { icon: LucideIcon; tone: BadgeTone }> = {
  'Energía Limpia': { icon: Leaf, tone: 'mint' },
  Agricultura: { icon: Sprout, tone: 'peach' },
  'Bienes Raíces': { icon: House, tone: 'lavender' },
  Logística: { icon: Truck, tone: 'blue' },
  Salud: { icon: Heart, tone: 'pink' },
  Tecnología: { icon: Laptop, tone: 'blue' },
}

// Verificación y riesgo son ejes independientes: la primera es un hecho (pasó KYB),
// el segundo es una opinión de un tercero. Nunca comparten slot ni se excluyen.
const riskPresentation: Record<RiskLevel, { label: string; tone: BadgeTone }> = {
  low: { label: 'Riesgo bajo', tone: 'blue' },
  medium: { label: 'Riesgo medio', tone: 'peach' },
  high: { label: 'Riesgo alto', tone: 'pink' },
}

export function OpportunityBadges({ opportunity }: OpportunityCardProps) {
  const category = categoryPresentation[opportunity.category]
  const risk = riskPresentation[opportunity.risk]

  return (
    <div className="opportunity-card__badges">
      <Badge icon={category.icon} tone={category.tone}>{opportunity.category}</Badge>
      {opportunity.verified && <Badge icon={BadgeCheck} tone="emerald">KYB verificado</Badge>}
      <Badge icon={ShieldCheck} tone={risk.tone}>{risk.label} · {opportunity.assessedBy}</Badge>
    </div>
  )
}

export function OpportunityCard({ opportunity }: OpportunityCardProps) {
  return (
    <article className="opportunity-card">
      <OpportunityBadges opportunity={opportunity} />

      <div className="opportunity-card__identity">
        <BusinessImage business={opportunity.business} />
        <div className="opportunity-card__copy">
          <h2>{opportunity.business.name}</h2>
          <p>{opportunity.description}</p>
        </div>
      </div>

      <OpportunityStats opportunity={opportunity} />

      <div className="opportunity-card__funding">
        <p><span>Inversión mínima</span><strong>{opportunity.minimumInvestment.toLocaleString('en-US')} USDT</strong></p>
        <FundingProgress percentage={opportunity.fundedPercentage} />
      </div>

      <Button className="opportunity-card__cta" to={routes.opportunity(opportunity.id)} aria-label={`Ver oportunidad de ${opportunity.business.name}`}>
        Ver oportunidad
        <ArrowRight size={22} strokeWidth={2.5} aria-hidden="true" />
      </Button>
    </article>
  )
}
