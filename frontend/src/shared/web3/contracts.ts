// ---------------------------------------------------------------------------
//  Direcciones y ABIs de los contratos
// ---------------------------------------------------------------------------
//
//  Las direcciones NO se escriben acá: se piden a `/api/health`, que las lee de
//  `contracts/deployments/<chainId>.json`, que lo escribe el script de
//  despliegue.
//
//  Una dirección hardcodeada en el frontend es la forma más común de terminar
//  apuntando la UI a un vault viejo después de un redespliegue, sin que nadie
//  lo note hasta que una transacción revierte.

import { createContext, useContext } from 'react'
import type { HealthResponse } from '../api/backend'

export { projectVaultAbi, eligibilityRegistryAbi, mockUsdtAbi } from '@s2d/shared'

export interface Deployment {
  vault: `0x${string}`
  usdt: `0x${string}`
  eligibility: `0x${string}`
  verifier: `0x${string}`
  operator: `0x${string}`
  feeRecipient: `0x${string}`
  blockNumber: number
}

interface DeploymentContextValue {
  deployment: Deployment | null
  chainId: number
  loading: boolean
  /** Mensaje accionable cuando falta el despliegue o el backend. */
  problem: string | null
  refresh: () => void
}

export const DeploymentContext = createContext<DeploymentContextValue | null>(null)

export function useDeployment(): DeploymentContextValue {
  const context = useContext(DeploymentContext)
  if (!context) throw new Error('useDeployment debe usarse dentro de DeploymentProvider')
  return context
}

/** Lanza si no hay despliegue: las pantallas que escriben en cadena lo necesitan. */
export function useRequiredDeployment(): Deployment {
  const { deployment, problem } = useDeployment()
  if (!deployment) throw new Error(problem ?? 'No hay contratos desplegados.')
  return deployment
}

export function toDeployment(health: HealthResponse): Deployment | null {
  if (!health.contracts) return null
  const c = health.contracts
  return {
    vault: c.vault as `0x${string}`,
    usdt: c.usdt as `0x${string}`,
    eligibility: c.eligibility as `0x${string}`,
    verifier: c.verifier as `0x${string}`,
    operator: c.operator as `0x${string}`,
    feeRecipient: c.feeRecipient as `0x${string}`,
    blockNumber: c.blockNumber,
  }
}

/** USDT tiene 6 decimales, no 18. Usar `parseEther` acá multiplica por 10^12. */
export const USDT_DECIMALS = 6
