import type { Business } from '../../business/model/business.types'

export type OpportunityCategory =
  | 'Clean Energy'
  | 'Agriculture'
  | 'Real Estate'
  | 'Logistics'
  | 'Healthcare'
  | 'Technology'

export type Risk = 'low' | 'medium' | 'high'

export interface Opportunity {
  id: string
  business: Business
  category: OpportunityCategory
  description: string
  fundingRequested: number
  expectedApy: number
  durationMonths: number
  verified: boolean
  risk: Risk
}
