// ---------------------------------------------------------------------------
//  Configuración web3  (backlog T12)
// ---------------------------------------------------------------------------
import { createConfig, http } from 'wagmi'
import { injected } from 'wagmi/connectors'
import { defineChain } from 'viem'

/**
 * Anvil como cadena de primera clase.
 *
 * viem trae `foundry` predefinida, pero se define acá para que la URL del RPC
 * salga de una variable de entorno: quien corra la demo contra un nodo remoto
 * no debería tener que tocar código.
 */
export const anvil = defineChain({
  id: 31337,
  name: 'Anvil local',
  nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
  rpcUrls: { default: { http: [import.meta.env.VITE_RPC_URL ?? 'http://127.0.0.1:8545'] } },
})

export const wagmiConfig = createConfig({
  chains: [anvil],
  connectors: [injected()],
  transports: { [anvil.id]: http() },
})

declare module 'wagmi' {
  interface Register {
    config: typeof wagmiConfig
  }
}
