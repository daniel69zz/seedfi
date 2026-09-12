import type { Investment } from '../../../shared/types/platform.types'

export interface InvestmentPayment {
  id: string
  label: string
  date: string
  amount: number
  status: 'SCHEDULED' | 'DISTRIBUTED' | 'PENDING'
}

export interface InvestmentDocument {
  id: string
  name: string
  status: 'validated' | 'pending'
  issuedAt: string
}

export interface InvestmentDetail {
  id: string
  opportunityId: string
  projectName: string
  company: { id: string; name: string; logo?: string }
  investment: {
    originalAmount: number
    estimatedReturn: number
    estimatedTotal: number
    pendingAmount: number
  }
  project: { progress: number; status: Investment['status'] }
  blockchain: {
    network: string
    status: 'confirmed' | 'pending'
    txHash: string
    isSimulated: boolean
  }
  nextPayment: { date: string; amount: number } | null
  paymentSchedule: InvestmentPayment[]
  documentation: InvestmentDocument[]
  investedAt: string
  guarantee?: string
}
