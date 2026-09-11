import { ArrowLeft, ArrowRight, SearchX } from 'lucide-react'
import { Link, useParams } from 'react-router-dom'
import { OpportunityBadges } from '../../../entities/opportunity/ui/OpportunityCard'
import { OpportunityStats } from '../../../entities/opportunity/ui/OpportunityStats'
import { opportunities } from '../../../shared/data/opportunities.mock'
import { BusinessImage } from '../../../shared/ui/business-image/BusinessImage'
import { Button } from '../../../shared/ui/button/Button'
import { FundingProgress } from '../../../shared/ui/funding-progress/FundingProgress'
import './OpportunityDetailPage.css'

export function OpportunityDetailPage() {
  const { id } = useParams<{ id: string }>()
  const opportunity = opportunities.find((item) => item.id === id)

  return (
    <main className="detail-page page-shell" id="main-content" aria-labelledby="detail-title">
      <Link className="detail-page__back" to="/">
        <ArrowLeft size={21} aria-hidden="true" />
        Volver a oportunidades
      </Link>

      {opportunity ? (
        <article className="detail-card">
          <OpportunityBadges opportunity={opportunity} />

          <div className="detail-card__identity">
            <BusinessImage business={opportunity.business} size="detail" />
            <div className="detail-card__business">
              <p className="detail-card__eyebrow">CONOCE LA EMPRESA</p>
              <h1 id="detail-title">{opportunity.business.name}</h1>
              <p className="detail-card__description">{opportunity.description}</p>
            </div>
          </div>

          <div className="detail-card__stats">
            <OpportunityStats opportunity={opportunity} />
          </div>

          <div className="detail-card__funding-summary">
            <p>Inversión mínima <strong>{opportunity.minimumInvestment.toLocaleString('en-US')} USDT</strong></p>
            <FundingProgress percentage={opportunity.fundedPercentage} />
          </div>

          <div className="detail-card__preview">
            <h2>Una mirada a esta oportunidad</h2>
            <p>Esta vista utiliza información mock del negocio y de la ronda. El detalle completo se incorporará en una siguiente etapa del frontend.</p>
          </div>

          <Button className="detail-card__browse" to="/">
            Seguir explorando
            <ArrowRight size={23} aria-hidden="true" />
          </Button>
        </article>
      ) : (
        <section className="detail-card detail-card--missing">
          <span className="detail-card__missing-icon"><SearchX size={38} aria-hidden="true" /></span>
          <h1 id="detail-title">Oportunidad no encontrada</h1>
          <p>Esta oportunidad no está disponible en la vista actual. Explora el marketplace para conocer otro negocio.</p>
          <Button to="/">
            Ver oportunidades
            <ArrowRight size={23} aria-hidden="true" />
          </Button>
        </section>
      )}
    </main>
  )
}
