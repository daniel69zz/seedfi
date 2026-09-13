// ---------------------------------------------------------------------------
//  Cuentas de la demo
// ---------------------------------------------------------------------------
//  En Anvil (31337) son las diez cuentas determinísticas de Foundry. Su
//  mnemónico es público: cualquiera en el mundo tiene estas llaves.
//
//  En una red pública (HashKey Chain, etc.) esas llaves NO sirven: los bots
//  vacían en segundos cualquier gas que se les mande. Ahí cada rol lee su llave
//  de `backend/.env` (DEMO_<ROL>_KEY), y el operador es SIEMPRE la llave del
//  backend (OPERATOR_PRIVATE_KEY): la que desplegó los contratos y la única que
//  puede crear proyectos en el vault.
import { privateKeyToAccount } from 'viem/accounts';
import type { Hex } from 'viem';
import { config } from './config.ts';

export interface DemoAccount { address: string; key: string }

const ANVIL = {
  operator:   { address: '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266', key: '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80' },
  developer:  { address: '0x70997970C51812dc3A010C7d01b50e0d17dc79C8', key: '0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d' },
  legal:      { address: '0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC', key: '0x5de4111afa1a4b94908f83103eb1f1706367c2e68ca870fc3fb9a804cdab365a' },
  supervisor: { address: '0x90F79bf6EB2c4f870365E785982E1f101E93b906', key: '0x7c852118294e51e653712a81e05800f419141751be58f605c371e15141b007a6' },
  investorA:  { address: '0x15d34AAf54267DB7D7c367839AAf71A00a2C6A65', key: '0x47e179ec197488593b187f80a00eb0da91f1b9d0b13f8733639f19c30a34926a' },
  investorB:  { address: '0x9965507D1a55bcC2695C58ba16FB37d819B0A4dc', key: '0x8b3a350cf5c34c9194ca85829a2df0ec3153be0318b5e2d3348e872092edffba' },
  investorC:  { address: '0x976EA74026E726554dB657fA54763abd0C3a0aa9', key: '0x92db14e403b83dfe3df233f83dfa3a0d7096f21ca9b0d6d6b8d88b2b4ec1564e' },
  // Patrimonio por debajo del mínimo de la ronda: existe para demostrar que el
  // rechazo ocurre, y que ocurre SIN que nadie vea su patrimonio.
  investorD:  { address: '0x14dC79964da2C08b23698B3D3cc7Ca32193d9955', key: '0x4bbbf85ce3377467afe5d46f804f221813b2bb87f24d81f60f1fcdbf7cbf4356' },
} as const;

export type DemoRole = keyof typeof ANVIL;

const ENV_KEYS: Record<Exclude<DemoRole, 'operator'>, string> = {
  developer: 'DEMO_DEVELOPER_KEY',
  legal: 'DEMO_LEGAL_KEY',
  supervisor: 'DEMO_SUPERVISOR_KEY',
  investorA: 'DEMO_INVESTOR_A_KEY',
  investorB: 'DEMO_INVESTOR_B_KEY',
  investorC: 'DEMO_INVESTOR_C_KEY',
  investorD: 'DEMO_INVESTOR_D_KEY',
};

function account(key: string): DemoAccount {
  return { address: privateKeyToAccount(key as Hex).address, key };
}

function fromEnv(): Record<DemoRole, DemoAccount> {
  const out = { operator: account(config.operatorKey) } as Record<DemoRole, DemoAccount>;
  const missing: string[] = [];
  for (const [role, envName] of Object.entries(ENV_KEYS) as [Exclude<DemoRole, 'operator'>, string][]) {
    const key = process.env[envName];
    if (!key) missing.push(envName);
    out[role] = key ? account(key) : ANVIL[role];
  }
  if (missing.length > 0) {
    console.warn(`[demo] Red ${config.chainId}: faltan ${missing.join(', ')} en backend/.env; se usan llaves públicas de Anvil.`);
  }
  return out;
}

export const DEMO: Record<DemoRole, DemoAccount> = config.chainId === 31337 ? ANVIL : fromEnv();
