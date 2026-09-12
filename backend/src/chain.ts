// ---------------------------------------------------------------------------
//  Capa de cadena — clientes viem, EIP-712 e indexado de eventos
// ---------------------------------------------------------------------------
import {
  createPublicClient, createWalletClient, http, parseEventLogs,
  type Address, type Hex, type PublicClient, type WalletClient,
} from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { projectVaultAbi, eligibilityRegistryAbi, mockUsdtAbi } from '@s2d/shared';
import { config, loadDeployment, type Deployment } from './config.ts';

export { projectVaultAbi, eligibilityRegistryAbi, mockUsdtAbi };

const chain = {
  id: config.chainId,
  name: `chain-${config.chainId}`,
  nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
  rpcUrls: { default: { http: [config.rpcUrl] } },
} as const;

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

export function operatorClient(): { client: WalletClient; address: Address } {
  const account = privateKeyToAccount(config.operatorKey as Hex);
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
  const logs = await publicClient().getLogs({
    address: deployment().vault as Address,
    fromBlock,
    toBlock,
  });

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
