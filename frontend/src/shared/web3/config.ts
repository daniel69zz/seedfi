// ---------------------------------------------------------------------------
//  Configuración web3  (backlog T12)
// ---------------------------------------------------------------------------
import { createConfig, http } from 'wagmi'
import { injected } from 'wagmi/connectors'
import { defineChain } from 'viem'
import { CHAINS } from '@s2d/shared'

/**
 * La red sale de `VITE_CHAIN_ID` (Anvil 31337 por defecto, HashKey Chain
 * Testnet 133 en el despliegue público) y tiene que coincidir con el
 * `CHAIN_ID` del backend. La URL del RPC se puede pisar con `VITE_RPC_URL`:
 * quien corra la demo contra otro nodo no debería tener que tocar código.
 */
const chainId = Number(import.meta.env.VITE_CHAIN_ID ?? 31337)
const known = CHAINS[chainId]
if (!known) throw new Error(`VITE_CHAIN_ID=${chainId} no está en CHAINS (packages/shared/src/chain.ts)`)

export const appChain = defineChain({
  id: known.id,
  name: known.name,
  nativeCurrency: known.nativeCurrency,
  rpcUrls: { default: { http: [import.meta.env.VITE_RPC_URL ?? known.rpcUrl] } },
  // Sin esto, `wallet_addEthereumChain` agrega la red a MetaMask sin explorador.
  ...(known.explorer ? { blockExplorers: { default: { name: `${known.name} Explorer`, url: known.explorer } } } : {}),
})

export const wagmiConfig = createConfig({
  chains: [appChain],
  connectors: [injected()],
  transports: { [appChain.id]: http() },
})

declare module 'wagmi' {
  interface Register {
    config: typeof wagmiConfig
  }
}
