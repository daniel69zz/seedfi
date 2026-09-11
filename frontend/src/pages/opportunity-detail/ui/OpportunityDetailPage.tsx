import { ArrowLeft, ArrowRight, SearchX } from 'lucide-react'
import { Link, useParams } from 'react-router-dom'
import { OpportunityBadges } from '../../../entities/opportunity/ui/OpportunityCard'
import { OpportunityStats } from '../../../entities/opportunity/ui/OpportunityStats'
import { opportunities } from '../../../shared/data/opportunities.mock'
import { BusinessImage } from '../../../shared/ui/business-image/BusinessImage'
import { Button } from '../../../shared/ui/button/Button'
import './OpportunityDetailPage.css'

export function OpportunityDetailPage() {
  const { id } = useParams<{ id: string }>()
  const opportunity = opportunities.find((item) => item.id === id)

  return (
    <main className="detail-page page-shell" id="main-content" aria-labelledby="detail-title">
      <Link className="detail-page__back" to="/">
        <ArrowLeft size={21} aria-hidden="true" />
        Back to opportunities
      </Link>

      {opportunity ? (
        <article className="detail-card">
          <OpportunityBadges opportunity={opportunity} />

          <div className="detail-card__identity">
            <BusinessImage business={opportunity.business} />
            <div className="detail-card__business">
              <p className="detail-card__eyebrow">MEET THE BUSINESS</p>
              <h1 id="detail-title">{opportunity.business.name}</h1>
              <p className="detail-card__description">{opportunity.description}</p>
            </div>
          </div>

          <div className="detail-card__stats">
            <OpportunityStats opportunity={opportunity} />
          </div>

          <div className="detail-card__preview">
            <h2>A closer look at this opportunity</h2>
            <p>This preview uses sample business and funding information. More project details will be available here as NORA grows.</p>
          </div>

          <Button className="detail-card__browse" to="/">
            Continue browsing
            <ArrowRight size={23} aria-hidden="true" />
          </Button>
        </article>
      ) : (
        <section className="detail-card detail-card--missing">
          <span className="detail-card__missing-icon"><SearchX size={38} aria-hidden="true" /></span>
          <h1 id="detail-title">Opportunity not found</h1>
          <p>This opportunity is not available in this preview. Explore the marketplace to discover another business.</p>
          <Button to="/">
            Browse opportunities
            <ArrowRight size={23} aria-hidden="true" />
          </Button>
        </section>
      )}
    </main>
  )
}
