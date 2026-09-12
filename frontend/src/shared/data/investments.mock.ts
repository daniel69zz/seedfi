import valleSurLogo from '../../assets/businesses/logos/vallesur.svg'
import andesSolarLogo from '../../assets/businesses/logos/andes-solar.svg'
import altiplanoQuinoaLogo from '../../assets/businesses/logos/altiplano-quinoa.svg'

interface InvestmentProjectMetadata {
  companyId: string
  companyLogo?: string
  guarantee: string
}

// Project metadata supplements the investments persisted by DemoProvider.
// Financial amounts and project progress always come from that investment.
export const investmentProjectMetadata: Record<string, InvestmentProjectMetadata> = {
  'residencial-mirador-valle': {
    companyId: 'vallesur',
    companyLogo: valleSurLogo,
    guarantee: 'Bien inmueble y pagaré empresarial vinculados al proyecto.',
  },
  'andes-solar-expansion': {
    companyId: 'andes-solar',
    companyLogo: andesSolarLogo,
    guarantee: 'Garantía empresarial y equipamiento del proyecto.',
  },
  'altiplano-quinoa-exporta': {
    companyId: 'altiplano-quinoa',
    companyLogo: altiplanoQuinoaLogo,
    guarantee: 'Pagaré empresarial y contratos de exportación.',
  },
}

export const investmentPaymentDates: Record<string, string> = {
  'inv-001': '2027-06-03',
}

export const investmentRouteAliases: Record<string, string> = {
  'residencial-mirador-del-valle': 'inv-001',
}
