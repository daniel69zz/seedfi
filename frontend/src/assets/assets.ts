import truthWorksLogo from './brand/truth-works-placeholder.svg'
import andesSolarLogo from './businesses/logos/andes-solar-placeholder.svg'
import altiplanoQuinoaLogo from './businesses/logos/altiplano-quinoa-placeholder.svg'
import andeSoftLogo from './businesses/logos/andesoft-placeholder.svg'
import valleSurPhoto from './businesses/photos/vallesur-placeholder.svg'
import rutasOrientePhoto from './businesses/photos/rutas-oriente-placeholder.svg'
import sumaSaludPhoto from './businesses/photos/sumasalud-placeholder.svg'
import marketplaceHero from './illustrations/investor-marketplace-hero.png'
import marketplaceHeroFallback from './illustrations/investor-marketplace-placeholder.svg'
import businessFallback from './placeholders/fallback.svg'

export const appAssets = {
  brand: {
    logo: truthWorksLogo,
  },
  businesses: {
    andesSolar: andesSolarLogo,
    altiplanoQuinoa: altiplanoQuinoaLogo,
    valleSur: valleSurPhoto,
    rutasOriente: rutasOrientePhoto,
    sumaSalud: sumaSaludPhoto,
    andeSoft: andeSoftLogo,
    fallback: businessFallback,
  },
  illustrations: {
    marketplaceHero,
    marketplaceHeroFallback,
  },
} as const
