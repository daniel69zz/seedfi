import marketplaceHero from '../../../assets/illustrations/marketplace-hero.png'
import './MarketplaceHero.css'

export function MarketplaceHero() {
  return (
    <section className="marketplace-hero" aria-labelledby="marketplace-title">
      <div className="marketplace-hero__copy">
        <p className="marketplace-hero__eyebrow">REAL BUSINESSES. BRIGHTER TOMORROWS.</p>
        <h1 id="marketplace-title">Browse businesses seeking investment</h1>
        <p className="marketplace-hero__subtitle">
          Discover loan and funding opportunities from verified businesses and choose the projects that fit your goals.
        </p>
      </div>
      <div className="marketplace-hero__art" aria-hidden="true">
        <img src={marketplaceHero} alt="" width="1040" height="430" />
        <p className="marketplace-hero__invest">Invest<br />in real progress.</p>
        <p className="marketplace-hero__community">People<br />Businesses<br />Stronger<br />Communities.</p>
      </div>
    </section>
  )
}
