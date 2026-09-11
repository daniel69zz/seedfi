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
import type { Opportunity, OpportunityCategory } from '../model/opportunity.types'
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

export function OpportunityBadges({ opportunity }: OpportunityCardProps) {
  const category = categoryPresentation[opportunity.category]
  const status = opportunity.verified
    ? { label: 'Verificado', tone: 'emerald' as const, icon: BadgeCheck }
    : opportunity.risk === 'medium'
      ? { label: 'Riesgo Medio', tone: 'peach' as const, icon: ShieldCheck }
      : opportunity.risk === 'high'
        ? { label: 'Riesgo Alto', tone: 'pink' as const, icon: ShieldCheck }
        : { label: 'Bajo Riesgo', tone: 'blue' as const, icon: ShieldCheck }

  return (
    <div className="opportunity-card__badges">
      <Badge icon={category.icon} tone={category.tone}>{opportunity.category}</Badge>
      <Badge icon={status.icon} tone={status.tone}>{status.label}</Badge>
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
