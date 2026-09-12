import { appAssets } from '../../assets/assets'
import type { Opportunity } from '../../entities/opportunity/model/opportunity.types'
import type { Proposal } from '../types/platform.types'

export function proposalToOpportunity(proposal: Proposal): Opportunity {
  return {
    id: proposal.id,
    projectName: proposal.projectName,
    business: { id: proposal.companyId, name: proposal.companyName, image: appAssets.businesses.valleSur, imageType: 'photo' },
    category: proposal.category,
    projectType: proposal.projectType,
    location: proposal.location,
    description: proposal.description,
    story: 'Esta oportunidad fue creada desde el flujo empresarial y publicada por administración dentro de la demostración.',
    fundingRequested: proposal.fundingRequested,
    fundedAmount: 0,
    expectedApy: proposal.expectedApy,
    totalReturnPct: Math.round(proposal.expectedApy * proposal.durationMonths / 12 * 100) / 100,
    durationMonths: proposal.durationMonths,
    minimumInvestment: proposal.minimumInvestment,
    maximumInvestment: Math.round(proposal.fundingRequested * .1),
    fundedPercentage: 0,
    investorCount: 0,
    verified: true,
    risk: 'medium',
    assessedBy: 'Evaluación demo',
    riskRationale: 'Proyecto recientemente publicado; consulta la documentación y condiciones antes de invertir.',
    status: 'Financiando',
    startDate: '2027-01-15',
    expectedReturnDate: '2029-01-15',
    fundUse: proposal.fundUse,
    milestones: [{ id: `${proposal.id}-m1`, title: 'Inicio del proyecto', date: '2027-01-15', description: 'Inicio sujeto al cierre de la ronda.', progress: 0, status: 'Pendiente' }],
    guarantees: [{ id: `${proposal.id}-g1`, type: proposal.guarantee, description: 'Garantía revisada durante el proceso administrativo mock.', declaredValue: proposal.fundingRequested * 1.25, status: 'Validada', documentName: 'Garantía.pdf', verified: true }],
    documents: [{ id: `${proposal.id}-d1`, name: 'Ficha del proyecto', type: 'Proyecto', date: proposal.submittedAt, status: 'Validado' }],
    riskFactors: [{ label: 'Riesgo general', level: 'medium', explanation: 'Evaluación preliminar basada en información mock.' }],
    vault: { network: 'Ethereum Sepolia', address: 'Pendiente de despliegue', status: 'Creado', lockedFunds: 0, releasedFunds: 0, transactionCount: 0, lastTransaction: proposal.submittedAt, transactionHash: 'Sin transacciones' },
  }
}
