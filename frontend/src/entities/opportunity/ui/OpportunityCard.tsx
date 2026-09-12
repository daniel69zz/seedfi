import {
  ArrowRight,
  BadgeCheck,
  Factory,
  HardHat,
  Heart,
  House,
  Laptop,
  MapPin,
  ShieldCheck,
  Sprout,
  Store,
  Truck,
  Zap,
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
  'Bienes Raíces': { icon: House, tone: 'lavender' },
  Construcción: { icon: HardHat, tone: 'peach' },
  Agricultura: { icon: Sprout, tone: 'peach' },
  Energía: { icon: Zap, tone: 'mint' },
  Tecnología: { icon: Laptop, tone: 'blue' },
  Logística: { icon: Truck, tone: 'blue' },
  Salud: { icon: Heart, tone: 'pink' },
  Industria: { icon: Factory, tone: 'lavender' },
  Comercio: { icon: Store, tone: 'mint' },
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
          <p className="opportunity-card__company">{opportunity.business.name}</p>
          <h2>{opportunity.projectName}</h2>
          <p>{opportunity.description}</p>
          <span className="opportunity-card__location"><MapPin size={13} aria-hidden="true" />{opportunity.location}</span>
        </div>
      </div>

      <OpportunityStats opportunity={opportunity} />

      <div className="opportunity-card__funding">
        <p><span>Recaudado</span><strong>{opportunity.fundedAmount.toLocaleString('en-US')} USDT</strong><small>Mínimo {opportunity.minimumInvestment.toLocaleString('en-US')} USDT</small></p>
        <FundingProgress percentage={opportunity.fundedPercentage} />
      </div>

      <Button className="opportunity-card__cta" to={routes.opportunity(opportunity.id)} aria-label={`Ver oportunidad de ${opportunity.business.name}`}>
        Ver oportunidad
        <ArrowRight size={22} strokeWidth={2.5} aria-hidden="true" />
      </Button>
    </article>
  )
}
