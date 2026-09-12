import type { Business } from '../../business/model/business.types'

export type OpportunityCategory =
  | 'Bienes Raíces'
  | 'Construcción'
  | 'Agricultura'
  | 'Energía'
  | 'Tecnología'
  | 'Logística'
  | 'Salud'
  | 'Industria'
  | 'Comercio'

export type RiskLevel = 'low' | 'medium' | 'high'
export type OpportunityStatus = 'Financiando' | 'Financiado' | 'Activo' | 'Completado'

export interface FundUseItem {
  label: string
  percentage: number
}

export interface ProjectMilestone {
  id: string
  title: string
  date: string
  description: string
  progress: number
  status: 'Pendiente' | 'En progreso' | 'Completado' | 'Retrasado'
}

export interface ProjectGuarantee {
  id: string
  type: string
  description: string
  declaredValue: number
  status: 'Pendiente' | 'En revisión' | 'Validada' | 'Rechazada'
  documentName: string
  verified: boolean
}

export interface ProjectDocument {
  id: string
  name: string
  type: string
  date: string
  status: 'Disponible' | 'Validado' | 'En revisión'
}

export interface RiskFactor {
  label: string
  level: RiskLevel
  explanation: string
}

export interface ProjectVault {
  network: string
  address: string
  status: 'Creado' | 'Financiando' | 'Fondos protegidos' | 'Liberado' | 'Cerrado'
  lockedFunds: number
  releasedFunds: number
  transactionCount: number
  lastTransaction: string
  transactionHash: string
}

export interface Opportunity {
  id: string
  projectName: string
  business: Business
  category: OpportunityCategory
  projectType: string
  location: string
  description: string
  story: string
  fundingRequested: number
  fundedAmount: number
  expectedApy: number
  totalReturnPct: number
  durationMonths: number
  minimumInvestment: number
  maximumInvestment?: number
  fundedPercentage: number
  investorCount: number
  verified: boolean
  risk: RiskLevel
  assessedBy: string
  riskRationale: string
  status: OpportunityStatus
  startDate: string
  expectedReturnDate: string
  fundUse: FundUseItem[]
  milestones: ProjectMilestone[]
  guarantees: ProjectGuarantee[]
  documents: ProjectDocument[]
  riskFactors: RiskFactor[]
  vault: ProjectVault
  /**
   * Quién evaluó el riesgo. Opcional: un proyecto recién publicado todavía no
   * pasó por el comité, y mostrar un evaluador vacío es peor que no mostrarlo.
   */
  assessedBy?: string
}

/**
 * Retorno total sobre el plazo completo, derivado del APY.
 *
 * No es un campo del dato: `expectedApy` es anual y el plazo varía, así que
 * guardar los dos por separado invita a que se desincronicen. Se deriva.
 */
export function totalReturnPct(opportunity: Pick<Opportunity, 'expectedApy' | 'durationMonths'>): number {
  return Math.round(opportunity.expectedApy * opportunity.durationMonths / 12 * 10) / 10
}
