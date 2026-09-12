import type { InvestmentDetail, InvestmentPayment } from '../../entities/investment/model/investment.types'
import { investmentPaymentDates, investmentProjectMetadata, investmentRouteAliases } from '../data/investments.mock'
import type { Investment } from '../types/platform.types'
import { fakeLoading } from '../utils/fakeLoading'

function slugify(value: string) {
  return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
}

function amount(value: number) {
  return Number.isFinite(value) ? Math.max(0, Math.round(value * 100) / 100) : 0
}

function maturityDate(investment: Investment) {
  const date = new Date(`${investment.investedAt.slice(0, 10)}T12:00:00Z`)
  if (!Number.isFinite(date.getTime())) return investment.nextPayment
  const day = date.getUTCDate()
  date.setUTCDate(1)
  date.setUTCMonth(date.getUTCMonth() + investment.durationMonths)
  const lastDay = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 0)).getUTCDate()
  date.setUTCDate(Math.min(day, lastDay))
  return date.toISOString().slice(0, 10)
}

function toInvestmentDetail(source: Investment): InvestmentDetail {
  const metadata = investmentProjectMetadata[source.opportunityId]
  const originalAmount = amount(source.amount)
  // Mock contractual estimate: APY over the agreed term, independent of construction progress.
  const estimatedReturn = amount(originalAmount * source.expectedApy / 100 * source.durationMonths / 12)
  const estimatedTotal = amount(originalAmount + estimatedReturn)
  const pendingReturn = amount(estimatedReturn - source.earningsReceived)
  const pendingCapital = amount(originalAmount - source.capitalRecovered)
  const pendingAmount = amount(pendingReturn + pendingCapital)
  const paymentDate = investmentPaymentDates[source.id] ?? source.nextPayment
  const upcomingStatus: InvestmentPayment['status'] = source.status === 'ACTIVE' ? 'SCHEDULED' : 'PENDING'
  const paymentSchedule: InvestmentPayment[] = [
    {
      id: `${source.id}-return`,
      label: 'Retorno estimado',
      date: paymentDate,
      amount: pendingReturn || estimatedReturn,
      status: pendingReturn === 0 ? 'DISTRIBUTED' : upcomingStatus,
    },
    {
      id: `${source.id}-capital`,
      label: 'Devolución de capital',
      date: maturityDate(source),
      amount: pendingCapital || originalAmount,
      status: pendingCapital === 0 ? 'DISTRIBUTED' : upcomingStatus,
    },
  ]

  return {
    id: source.id,
    opportunityId: source.opportunityId,
    projectName: source.projectName,
    company: { id: metadata?.companyId ?? slugify(source.companyName), name: source.companyName, logo: metadata?.companyLogo },
    investment: { originalAmount, estimatedReturn, estimatedTotal, pendingAmount },
    project: { progress: Number.isFinite(source.projectProgress) ? Math.min(100, Math.max(0, source.projectProgress)) : 0, status: source.status },
    blockchain: {
      network: 'Ethereum Sepolia',
      status: source.transactionHash ? 'confirmed' : 'pending',
      txHash: source.transactionHash,
      isSimulated: true,
    },
    nextPayment: source.status === 'COMPLETED' || pendingAmount === 0
      ? null
      : { date: pendingReturn > 0 ? paymentDate : maturityDate(source), amount: pendingReturn || pendingCapital },
    paymentSchedule,
    documentation: [{ id: `${source.id}-receipt`, name: 'Comprobante de inversión', status: source.transactionHash ? 'validated' : 'pending', issuedAt: source.investedAt }],
    investedAt: source.investedAt,
    guarantee: metadata?.guarantee,
  }
}

export const investmentService = {
  async getById(id: string, source: Investment[], signal?: AbortSignal): Promise<InvestmentDetail | null> {
    // This boundary can later call GET /api/investments/:id without changing the UI contract.
    await fakeLoading(undefined, signal)
    const requestedId = investmentRouteAliases[id] ?? id
    const investment = source.find((item) => item.id === requestedId)
      ?? source.find((item) => item.opportunityId === id || slugify(item.projectName) === id)
    return investment ? toInvestmentDetail(investment) : null
  },
}
