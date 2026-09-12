import { opportunities } from '../data/opportunities.mock'

function delay(milliseconds: number) {
  return new Promise<void>((resolve) => window.setTimeout(resolve, milliseconds))
}

export const opportunityService = {
  async getAll() {
    await delay(120)
    return opportunities
  },
  async getById(id: string) {
    await delay(100)
    return opportunities.find((opportunity) => opportunity.id === id) ?? null
  },
}

export const web3MockService = {
  async connectWallet() {
    await delay(650)
    return { address: '0x7A1c...91F2', balance: 12500 }
  },
  async approveUSDT() {
    await delay(700)
    return { approved: true }
  },
  async invest() {
    await delay(950)
    return { hash: `0x${Math.random().toString(16).slice(2, 12)}...${Math.random().toString(16).slice(2, 6)}`, confirmed: true }
  },
  async getVaultState() {
    await delay(100)
    return { status: 'FUNDING', network: 'Ethereum Sepolia' }
  },
}
