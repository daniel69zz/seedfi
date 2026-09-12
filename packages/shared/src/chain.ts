// ---------------------------------------------------------------------------
//  Configuración de cadena y direcciones desplegadas
// ---------------------------------------------------------------------------

export interface ChainConfig {
  id: number;
  name: string;
  rpcUrl: string;
  explorer: string | null;
  nativeCurrency: { name: string; symbol: string; decimals: number };
}

/** Redes soportadas. La L2/testnet se elige por env, nunca hardcodeada en la UI. */
export const CHAINS: Record<number, ChainConfig> = {
  31337: {
    id: 31337,
    name: 'Anvil local',
    rpcUrl: 'http://127.0.0.1:8545',
    explorer: null,
    nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
  },
  43113: {
    id: 43113,
    name: 'Avalanche Fuji',
    rpcUrl: 'https://api.avax-test.network/ext/bc/C/rpc',
    explorer: 'https://testnet.snowtrace.io',
    nativeCurrency: { name: 'Avalanche', symbol: 'AVAX', decimals: 18 },
  },
  84532: {
    id: 84532,
    name: 'Base Sepolia',
    rpcUrl: 'https://sepolia.base.org',
    explorer: 'https://sepolia.basescan.org',
    nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
  },
  11155111: {
    id: 11155111,
    name: 'Ethereum Sepolia',
    rpcUrl: 'https://rpc.sepolia.org',
    explorer: 'https://sepolia.etherscan.io',
    nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
  },
};

/** Direcciones que escribe `scripts/deploy-local.sh` tras desplegar. */
export interface Deployment {
  chainId: number;
  vault: string;
  usdt: string;
  eligibility: string;
  verifier: string;
  operator: string;
  feeRecipient: string;
  deployedAt: string;
  blockNumber: number;
}

export function explorerTxUrl(chainId: number, hash: string): string | null {
  const explorer = CHAINS[chainId]?.explorer;
  return explorer ? `${explorer}/tx/${hash}` : null;
}

export function explorerAddressUrl(chainId: number, address: string): string | null {
  const explorer = CHAINS[chainId]?.explorer;
  return explorer ? `${explorer}/address/${address}` : null;
}

/** Acorta una dirección para mostrar. Solo presentación. */
export function shortAddress(address: string): string {
  return address.length > 12 ? `${address.slice(0, 6)}…${address.slice(-4)}` : address;
}
