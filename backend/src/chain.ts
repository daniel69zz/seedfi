// ---------------------------------------------------------------------------
//  Capa de cadena — clientes viem, EIP-712 e indexado de eventos
// ---------------------------------------------------------------------------
import {
  createPublicClient, createWalletClient, http, nonceManager, parseEventLogs,
  type Address, type Hex, type PublicClient, type WalletClient,
} from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { projectVaultAbi, eligibilityRegistryAbi, mockUsdtAbi, CHAINS } from '@s2d/shared';
import { config, loadDeployment, type Deployment } from './config.ts';

export { projectVaultAbi, eligibilityRegistryAbi, mockUsdtAbi };

export const chain = {
  id: config.chainId,
  name: CHAINS[config.chainId]?.name ?? `chain-${config.chainId}`,
  nativeCurrency: CHAINS[config.chainId]?.nativeCurrency ?? { name: 'Ether', symbol: 'ETH', decimals: 18 },
  rpcUrls: { default: { http: [config.rpcUrl] } },
} as const;

/** Tramo máximo de bloques por `eth_getLogs`. Los RPC públicos cortan rangos
 *  grandes, y un backend que estuvo apagado unos días en una red de 2 s por
 *  bloque acumula cientos de miles. */
const LOG_RANGE = 50_000n;

let cachedDeployment: Deployment | null | undefined;

export function deployment(): Deployment {
  if (cachedDeployment === undefined) cachedDeployment = loadDeployment();
  if (!cachedDeployment) {
    throw new ChainUnavailableError(
      `No hay despliegue para la red ${config.chainId}. Corré:  npm run chain  y después  npm run contracts:deploy:local`,
    );
  }
  return cachedDeployment;
}

export class ChainUnavailableError extends Error {}

export function publicClient(): PublicClient {
  return createPublicClient({ chain, transport: http(config.rpcUrl) }) as PublicClient;
}

/**
 * Cuenta con nonce llevado en memoria.
 *
 * Los RPC públicos (testnet.hsk.xyz) están detrás de un balanceador: justo
 * después de minar una tx, otro nodo puede responder un `pending` nonce viejo
 * y la siguiente tx sale con el mismo nonce → "replacement transaction
 * underpriced". Contar localmente evita preguntarle al nodo en cada envío.
 */
export function signer(key: string) {
  return privateKeyToAccount(key as Hex, { nonceManager });
}

export function operatorClient(): { client: WalletClient; address: Address } {
  const account = signer(config.operatorKey);
  return {
    client: createWalletClient({ account, chain, transport: http(config.rpcUrl) }),
    address: account.address,
  };
}

// ---------------------------------------------------------------------- EIP-712

/**
 * Dominio EIP-712 del vault. Incluye `chainId` y `verifyingContract`, así que
 * una firma de testnet no vale en mainnet ni la de un despliegue en otro.
 *
 * El nombre del dominio ("TruthWorks") sale del contrato y NO puede cambiarse
 * acá por gusto: si no es idéntico byte a byte, el digest da distinto, la firma
 * recupera otra dirección y el contrato la rechaza como "firmante no autorizado".
 */
export function attestationDomain() {
  return {
    name: 'TruthWorks',
    version: '1',
    chainId: config.chainId,
    verifyingContract: deployment().vault as Address,
  } as const;
}

export const ATTESTATION_TYPES = {
  Attestation: [
    { name: 'projectId', type: 'uint256' },
    { name: 'milestoneIndex', type: 'uint8' },
    { name: 'evidenceHash', type: 'bytes32' },
    { name: 'approved', type: 'bool' },
    { name: 'nonce', type: 'uint256' },
    { name: 'expiresAt', type: 'uint64' },
  ],
} as const;

export interface AttestationMessage {
  projectId: bigint;
  milestoneIndex: number;
  evidenceHash: Hex;
  approved: boolean;
  nonce: bigint;
  expiresAt: bigint;
}

/** Firma una attestation con la llave de un verificador. */
export async function signAttestation(verifierKey: Hex, message: AttestationMessage): Promise<{ signature: Hex; signer: Address; digest: Hex }> {
  const account = privateKeyToAccount(verifierKey);
  const signature = await account.signTypedData({
    domain: attestationDomain(),
    types: ATTESTATION_TYPES,
    primaryType: 'Attestation',
    message,
  });
  // El digest sale del contrato, no de una reimplementación local: si el
  // hashing del backend divergiera del on-chain, el `revoke` apuntaría a un
  // digest que nunca se va a usar y la revocación no haría nada.
  const digest = await publicClient().readContract({
    address: deployment().vault as Address,
    abi: projectVaultAbi,
    functionName: 'hashAttestation',
    args: [message],
  }) as Hex;
  return { signature, signer: account.address, digest };
}

// ------------------------------------------------------------------- lectura

export interface OnChainProject {
  builder: Address;
  target: bigint;
  endDate: bigint;
  raised: bigint;
  released: bigint;
  nextMilestone: number;
  status: number;
  totalRepaid: bigint;
  frozenRemaining: bigint;
  originationBps: number;
  successBps: number;
}

const STATUS_NAMES = ['NONE', 'FUNDING', 'ACTIVE', 'COMPLETED', 'ROUND_FAILED', 'MILESTONE_FAILED'] as const;
export function statusName(status: number): string {
  return STATUS_NAMES[status] ?? 'UNKNOWN';
}

export async function readProject(onChainId: number): Promise<OnChainProject | null> {
  const raw = await publicClient().readContract({
    address: deployment().vault as Address,
    abi: projectVaultAbi,
    functionName: 'projects',
    args: [BigInt(onChainId)],
  }) as readonly unknown[];

  const [builder, target, endDate, raised, released, nextMilestone, status,
         totalRepaid, frozenRemaining, originationBps, successBps] = raw as [
    Address, bigint, bigint, bigint, bigint, number, number, bigint, bigint, number, number];

  if (status === 0) return null; // Status.NONE: el proyecto no existe en cadena
  return { builder, target, endDate, raised, released, nextMilestone, status, totalRepaid, frozenRemaining, originationBps, successBps };
}

export async function readMilestones(onChainId: number) {
  return await publicClient().readContract({
    address: deployment().vault as Address,
    abi: projectVaultAbi,
    functionName: 'milestones',
    args: [BigInt(onChainId)],
  }) as readonly { bps: number; role: number; deadline: bigint; released: boolean }[];
}

// ------------------------------------------------------------------ eventos

/**
 * Los eventos que le importan al dashboard. Se indexan en vez de consultarse en
 * vivo porque `projects()` da el estado ACTUAL y no la historia: quién invirtió
 * cuánto y cuándo, qué hito se liberó contra qué firma, cuándo se congeló el
 * capital. Eso es exactamente lo que un inversionista necesita poder auditar.
 */
export const INDEXED_EVENTS = [
  'ProjectCreated', 'Invested', 'RoundFunded', 'MilestoneReleased', 'MilestoneFailed',
  'RoundRefunded', 'RemainingRefunded', 'Repaid', 'Claimed', 'FeeCharged', 'VerifierGranted',
] as const;

export interface IndexedEvent {
  kind: string;
  onChainId: number | null;
  blockNumber: number;
  txHash: string;
  logIndex: number;
  payload: Record<string, string>;
}

export async function fetchEvents(fromBlock: bigint, toBlock: bigint): Promise<IndexedEvent[]> {
  const logs = [];
  for (let start = fromBlock; start <= toBlock; start += LOG_RANGE) {
    const end = start + LOG_RANGE - 1n < toBlock ? start + LOG_RANGE - 1n : toBlock;
    logs.push(...await publicClient().getLogs({
      address: deployment().vault as Address,
      fromBlock: start,
      toBlock: end,
    }));
  }

  const parsed = parseEventLogs({ abi: projectVaultAbi, logs });
  const out: IndexedEvent[] = [];

  for (const log of parsed) {
    if (!INDEXED_EVENTS.includes(log.eventName as never)) continue;
    const args = (log.args ?? {}) as Record<string, unknown>;
    const payload: Record<string, string> = {};
    for (const [k, v] of Object.entries(args)) payload[k] = String(v);

    out.push({
      kind: log.eventName,
      onChainId: args.projectId != null ? Number(args.projectId) : null,
      blockNumber: Number(log.blockNumber),
      txHash: log.transactionHash,
      logIndex: log.logIndex,
      payload,
    });
  }
  return out;
}

// ---------------------------------------------------------------- escritura

/**
 * Espera el recibo Y COMPROBA QUE NO REVIRTIÓ.
 *
 * `writeContract` de viem no simula: una transacción que revierte igual se mina,
 * y `waitForTransactionReceipt` devuelve el recibo sin lanzar. Quien solo
 * espera el recibo cree que funcionó.
 *
 * Esto no es teórico: el seed daba "DEMO LISTA" con el `createProject`
 * revertido, y el proyecto quedaba en la base apuntando a un vault donde nunca
 * existió.
 */
/**
 * Confirmaciones a esperar tras cada tx.
 *
 * En Anvil hay un solo nodo: con el recibo alcanza. Un RPC público está detrás
 * de un balanceador (testnet.hsk.xyz va por Cloudflare a varios nodos): el
 * recibo puede venir de uno y la estimación de la tx siguiente de otro que
 * todavía no vio ese bloque. Pasó de verdad: `approve` confirmado y el
 * `invest` inmediato revertía con `TransferenciaFallida` porque ese nodo aún
 * veía allowance 0. Un bloque extra (~2 s) les da tiempo a ponerse al día.
 */
export const CONFIRMATIONS = config.chainId === 31337 ? 1 : 2;

export async function confirm(hash: Hex, what: string): Promise<Hex> {
  const receipt = await publicClient().waitForTransactionReceipt({ hash, confirmations: CONFIRMATIONS });
  if (receipt.status !== 'success') {
    throw new Error(`La transacción de «${what}» revirtió en cadena (tx ${hash}).`);
  }
  return hash;
}

/**
 * Primer id de proyecto libre EN EL VAULT, desde `startAt`.
 *
 * La base y la cadena tienen espacios de ids independientes: `--reset` limpia
 * la primera y no puede limpiar la segunda. Sin esto, el primer sembrado
 * después de un reset choca contra un id que la cadena ya tiene ocupado.
 */
export async function nextFreeOnChainId(startAt: number): Promise<number> {
  for (let id = startAt; id < startAt + 1000; id++) {
    if (await readProject(id) === null) return id;
  }
  throw new Error('No se encontró un id de proyecto libre en el vault.');
}
