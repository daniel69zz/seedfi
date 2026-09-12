import type { OpportunityCategory, RiskLevel } from '../../entities/opportunity/model/opportunity.types'

export type UserRole = 'INVESTOR' | 'COMPANY' | 'ADMIN'
export type KycStatus = 'NOT_STARTED' | 'IN_PROGRESS' | 'PENDING' | 'VERIFIED' | 'REJECTED' | 'ACTION_REQUIRED'
export type KybStatus = 'INCOMPLETE' | 'SUBMITTED' | 'UNDER_REVIEW' | 'VERIFIED' | 'REJECTED' | 'ACTION_REQUIRED'
export type ProjectStatus =
  | 'DRAFT'
  | 'SUBMITTED'
  | 'UNDER_REVIEW'
  | 'CHANGES_REQUESTED'
  | 'APPROVED'
  | 'REJECTED'
  | 'PUBLISHED'
  | 'FUNDING'
  | 'FUNDED'
  | 'ACTIVE'
  | 'REPAYING'
  | 'COMPLETED'
  | 'DEFAULTED'

export interface DemoUser {
  id: string
  name: string
  email: string
  role: UserRole
  kycStatus?: KycStatus
  kybStatus?: KybStatus
  companyName?: string
}

export interface Investment {
  id: string
  opportunityId: string
  projectName: string
  companyName: string
  amount: number
  investedAt: string
  expectedApy: number
  durationMonths: number
  nextPayment: string
  capitalRecovered: number
  earningsReceived: number
  projectProgress: number
  status: 'ACTIVE' | 'PENDING' | 'COMPLETED' | 'DEFAULTED'
  transactionHash: string
}

export interface Proposal {
  id: string
  companyId: string
  companyName: string
  projectName: string
  category: OpportunityCategory
  projectType: string
  location: string
  description: string
  fundingRequested: number
  expectedApy: number
  durationMonths: number
  minimumInvestment: number
  status: ProjectStatus
  submittedAt: string
  priority: 'Alta' | 'Media' | 'Normal'
  fundUse: Array<{ label: string; percentage: number }>
  guarantee: string
  reviewerNotes: string[]
}

export interface CompanySummary {
  id: string
  name: string
  city: string
  representative: string
  nit: string
  sector: string
  kybStatus: KybStatus
  registeredAt: string
}

export interface Payment {
  id: string
  companyName: string
  projectName: string
  amount: number
  expectedAt: string
  receivedAt?: string
  status: 'SCHEDULED' | 'PENDING' | 'RECEIVED' | 'DISTRIBUTED' | 'LATE' | 'FAILED'
}

export interface DemoNotification {
  id: string
  title: string
  description: string
  createdAt: string
  read: boolean
  audience: UserRole
}

export interface WalletTransaction {
  id: string
  type: 'Depósito' | 'Inversión' | 'Pago recibido' | 'Retorno' | 'Retiro' | 'Reembolso'
  amount: number
  date: string
  status: 'Confirmada' | 'Pendiente' | 'Fallida'
  hash?: string
}

export interface RiskSummary {
  level: RiskLevel
  rationale: string
}
