/* oxlint-disable react/only-export-components */
import { createContext, useContext, useEffect, useMemo, useState } from 'react'
import type { PropsWithChildren } from 'react'
import { initialInvestments, initialProposals } from '../../../shared/data/platform.mock'
import type { Investment, ProjectStatus, Proposal } from '../../../shared/types/platform.types'

interface CreateInvestmentInput {
  opportunityId: string
  projectName: string
  companyName: string
  amount: number
  expectedApy: number
  durationMonths: number
  transactionHash: string
}

interface DemoContextValue {
  investments: Investment[]
  proposals: Proposal[]
  createInvestment: (input: CreateInvestmentInput) => Investment
  addProposal: (proposal: Omit<Proposal, 'id' | 'submittedAt'>) => Proposal
  updateProposalStatus: (id: string, status: ProjectStatus) => void
}

const INVESTMENTS_KEY = 'seed2deed.demo.investments'
const PROPOSALS_KEY = 'seed2deed.demo.proposals'
const DemoContext = createContext<DemoContextValue | null>(null)

function readStored<T>(key: string, fallback: T): T {
  try {
    const stored = window.localStorage.getItem(key)
    return stored ? JSON.parse(stored) as T : fallback
  } catch {
    return fallback
  }
}

export function DemoProvider({ children }: PropsWithChildren) {
  const [investments, setInvestments] = useState<Investment[]>(() => readStored(INVESTMENTS_KEY, initialInvestments))
  const [proposals, setProposals] = useState<Proposal[]>(() => readStored(PROPOSALS_KEY, initialProposals))

  useEffect(() => { window.localStorage.setItem(INVESTMENTS_KEY, JSON.stringify(investments)) }, [investments])
  useEffect(() => { window.localStorage.setItem(PROPOSALS_KEY, JSON.stringify(proposals)) }, [proposals])

  const value = useMemo<DemoContextValue>(() => ({
    investments,
    proposals,
    createInvestment(input) {
      const investment: Investment = {
        id: `inv-${Date.now()}`,
        ...input,
        investedAt: new Date().toISOString(),
        nextPayment: new Date(Date.now() + input.durationMonths * 30 * 86400000).toISOString(),
        capitalRecovered: 0,
        earningsReceived: 0,
        projectProgress: 0,
        status: 'PENDING',
      }
      setInvestments((current) => [investment, ...current])
      return investment
    },
    addProposal(input) {
      const proposal: Proposal = { ...input, id: `prop-${Date.now()}`, submittedAt: new Date().toISOString() }
      setProposals((current) => [proposal, ...current])
      return proposal
    },
    updateProposalStatus(id, status) {
      setProposals((current) => current.map((proposal) => proposal.id === id ? { ...proposal, status } : proposal))
    },
  }), [investments, proposals])

  return <DemoContext.Provider value={value}>{children}</DemoContext.Provider>
}

export function useDemo() {
  const context = useContext(DemoContext)
  if (!context) throw new Error('useDemo debe utilizarse dentro de DemoProvider')
  return context
}
