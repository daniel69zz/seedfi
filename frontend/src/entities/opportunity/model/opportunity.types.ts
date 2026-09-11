import type { Business } from '../../business/model/business.types'

export type OpportunityCategory =
  | 'Energía Limpia'
  | 'Agricultura'
  | 'Bienes Raíces'
  | 'Logística'
  | 'Salud'
  | 'Tecnología'

export type RiskLevel = 'low' | 'medium' | 'high'

export interface Opportunity {
  id: string
  business: Business
  category: OpportunityCategory
  description: string
  fundingRequested: number
  expectedApy: number
  durationMonths: number
  minimumInvestment: number
  fundedPercentage: number
  verified: boolean
  risk: RiskLevel
}
