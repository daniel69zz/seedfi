// ---------------------------------------------------------------------------
//  Configuración
// ---------------------------------------------------------------------------
import { readFileSync, existsSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
export const REPO_ROOT = resolve(here, '../..');

export const config = {
  port: Number(process.env.PORT ?? 4000),
  host: process.env.HOST ?? '127.0.0.1',
  dbPath: process.env.DB_PATH ?? join(REPO_ROOT, 'backend/data/seed2deed.db'),
  chainId: Number(process.env.CHAIN_ID ?? 31337),
  rpcUrl: process.env.RPC_URL ?? 'http://127.0.0.1:8545',

  /**
   * Llave del operador. En local es la cuenta 0 de Anvil, que es pública y
   * conocida por todo el mundo.
   *
   * En producción esto NO es una variable de entorno con una llave adentro: es
   * una firma delegada a un KMS o a una multisig. Un backend que puede firmar
   * como operador y además está expuesto a internet es un único servidor
   * comprometido de distancia respecto de poder crear proyectos falsos.
   */
  operatorKey: process.env.OPERATOR_PRIVATE_KEY
    ?? '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80',

  /** Raíz del circuito compilado, para servirlo al navegador. */
  circuitPath: join(REPO_ROOT, 'circuits/eligibility/target/eligibility.json'),

  corsOrigins: (process.env.CORS_ORIGINS ?? 'http://localhost:5173,http://127.0.0.1:5173').split(','),
} as const;

export interface Deployment {
  chainId: number;
  vault: string;
  usdt: string;
  eligibility: string;
  verifier: string;
  operator: string;
  feeRecipient: string;
  blockNumber: number;
}

/**
 * Lee las direcciones del despliegue. Si no existen, el backend arranca igual
 * pero en modo "sin cadena": la API de dossiers sirve, y todo lo que toque
 * contratos devuelve un error claro en vez de un `undefined` que explota tres
 * capas más abajo.
 */
export function loadDeployment(chainId = config.chainId): Deployment | null {
  const path = join(REPO_ROOT, 'contracts/deployments', `${chainId}.json`);
  if (!existsSync(path)) return null;
  return JSON.parse(readFileSync(path, 'utf8')) as Deployment;
}
