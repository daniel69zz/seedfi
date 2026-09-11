import { useState } from 'react'
import { appAssets } from '../../../assets/assets'
import './MarketplaceHero.css'

export function MarketplaceHero() {
  const [useFallback, setUseFallback] = useState(false)

  return (
    <section className="marketplace-hero" aria-labelledby="marketplace-title">
      <div className="marketplace-hero__copy">
        <p className="marketplace-hero__eyebrow">EMPRESAS REALES. INVERSIÓN CONFIABLE.</p>
        <h1 id="marketplace-title">Encuentra oportunidades para invertir</h1>
        <p className="marketplace-hero__subtitle">
          Explora negocios bolivianos verificados y elige las oportunidades que se alineen con tus objetivos.
        </p>
      </div>

      <div className="marketplace-hero__art" aria-hidden="true">
        <img
          src={useFallback ? appAssets.illustrations.marketplaceHeroFallback : appAssets.illustrations.marketplaceHero}
          alt=""
          onError={() => setUseFallback(true)}
        />
        <p className="marketplace-hero__invest">Invierte<br />en progreso real.</p>
        <p className="marketplace-hero__community">Personas<br />Negocios<br />Comunidades.</p>
      </div>
    </section>
  )
}
