// ---------------------------------------------------------------------------
//  Cliente del backend  (backlog T13)
// ---------------------------------------------------------------------------
//
//  Un único punto de contacto con la API. Que sea uno solo importa por dos
//  razones concretas:
//
//  1. El manejo de errores está acá y no repetido en veinte componentes. La API
//     responde `{ error, details }` con códigos accionables; si cada `fetch`
//     suelto los interpretara a su manera, la mitad de los mensajes útiles que
//     el backend se tomó el trabajo de escribir se perderían en un
//     "algo salió mal".
//  2. Los tipos vienen de `@s2d/shared`, el mismo paquete que usa el backend.
//     Cambiar el dossier rompe la compilación del frontend en vez de romper la
//     pantalla en runtime.

import type { ProjectDossier, ProjectStatus, Evidence, RiskDimension } from '@s2d/shared'

/** En dev, Vite proxea `/api` al backend: mismo origen, sin CORS. */
const BASE = import.meta.env.VITE_API_URL ?? ''

export class ApiError extends Error {
  readonly status: number
  readonly details?: unknown

  constructor(message: string, status: number, details?: unknown) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.details = details
  }

  /** `422` trae los problemas del dossier campo por campo. */
  get validationIssues(): { field: string; message: string; severity: string }[] {
    return Array.isArray(this.details) ? this.details : []
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  let response: Response
  try {
    response = await fetch(`${BASE}${path}`, {
      ...init,
      headers: { 'Content-Type': 'application/json', ...init?.headers },
    })
  } catch {
    // Distinguir "el servidor no está" de "el servidor dijo que no" ahorra
    // muchísimo tiempo de depuración.
    throw new ApiError(
      'No se pudo contactar al backend. ¿Está corriendo?  npm run dev:backend',
      0,
    )
  }

  if (response.status === 204) return undefined as T

  const body = await response.json().catch(() => ({}))
  if (!response.ok) {
    throw new ApiError(body.error ?? `Error ${response.status}`, response.status, body.details)
  }
  return body as T
}

const get = <T>(path: string) => request<T>(path)
const post = <T>(path: string, body?: unknown) =>
  request<T>(path, { method: 'POST', body: JSON.stringify(body ?? {}) })
const patch = <T>(path: string, body: unknown) =>
  request<T>(path, { method: 'PATCH', body: JSON.stringify(body) })

// ------------------------------------------------------------------- tipos

export interface HealthResponse {
  ok: boolean
  chainId: number
  rpcUrl: string
  deployed: boolean
  contracts: {
    vault: string; usdt: string; eligibility: string; verifier: string
    operator: string; feeRecipient: string; blockNumber: number
  } | null
}

export interface ValidationIssue {
  field: string
  message: string
  severity: 'ERROR' | 'WARNING'
}

export interface ChainMilestone {
  index: number
  bps: number
  role: 'LEGAL' | 'SUPERVISOR'
  deadline: string
  released: boolean
  state: 'PENDING' | 'IN_REVIEW' | 'RELEASED'
  amount: string
}

export interface ChainEvent {
  kind: string
  blockNumber: number
  txHash: string
  logIndex: number
  payload: Record<string, string>
  observedAt: string
}

export interface ChainState {
  vault: string
  chainId: number
  status: 'FUNDING' | 'ACTIVE' | 'COMPLETED' | 'ROUND_FAILED' | 'MILESTONE_FAILED'
  target: string
  raised: string
  released: string
  /** Lo que sigue en el vault. El número que le importa al inversionista. */
  locked: string
  frozenRemaining: string
  totalRepaid: string
  nextMilestone: number
  originationBps: number
  successBps: number
  milestones: ChainMilestone[]
  events: ChainEvent[]
}

export interface ProjectDetail {
  project: ProjectDossier
  validation: ValidationIssue[]
  evidence: Evidence[]
  reviewNotes: { id: string; author: string; decision: string; body: string; created_at: string }[]
  events: ChainEvent[]
}

export interface MilestoneReview {
  milestone: { index: number; title: string; description: string; bps: number; role: 'LEGAL' | 'SUPERVISOR'; deadline: string; requiredEvidence: string[] }
  evidence: Evidence[]
  requiredEvidence: string[]
  missingKinds: string[]
  bundleHash: string | null
  attestations: StoredAttestation[]
  verifiers: { id: string; address: string; name: string; role: 'LEGAL' | 'SUPERVISOR'; license: string; organization: string }[]
}

export interface StoredAttestation {
  digest: string
  projectId: string
  milestoneIndex: number
  evidenceHash: string
  approved: boolean
  nonce: string
  expiresAt: number
  signature: string
  signer: string
  signedAt: string
  submittedTx: string | null
}

export interface Investor {
  id: string
  address: string
  displayName: string
  email: string
  kycStatus: 'PENDING' | 'APPROVED' | 'REJECTED'
  kycSyncedAt: string | null
  createdAt: string
}

export interface IssuedCredentialSecret {
  secret: string
  jurisdiction: number
  netWorth: string
  expiresAt: number
}

export interface MerklePathResponse {
  root: string
  path: string[]
  indexBits: boolean[]
  index: number
}

// -------------------------------------------------------------------- API

export const api = {
  health: () => get<HealthResponse>('/api/health'),
  sync: () => post<{ events: number }>('/api/sync'),

  projects: {
    list: (status?: ProjectStatus[]) =>
      get<{ projects: ProjectDossier[] }>(`/api/projects${status ? `?status=${status.join(',')}` : ''}`),
    marketplace: () => get<{ projects: ProjectDossier[] }>('/api/marketplace'),
    detail: (id: string) => get<ProjectDetail>(`/api/projects/${id}`),
    chain: (id: string) => get<ChainState>(`/api/projects/${id}/chain`),

    create: (dossier: unknown) =>
      post<{ project: ProjectDossier; validation: ValidationIssue[] }>('/api/projects', dossier),
    update: (id: string, patchBody: Partial<ProjectDossier>) =>
      patch<{ project: ProjectDossier; validation: ValidationIssue[] }>(`/api/projects/${id}`, patchBody),

    setRisk: (id: string, body: { scores: Record<RiskDimension, number>; rationale: string; assessedBy: string }) =>
      post<{ project: ProjectDossier }>(`/api/projects/${id}/risk`, body),
    submit: (id: string) => post<{ project: ProjectDossier }>(`/api/projects/${id}/submit`),
    review: (id: string, body: { decision: string; note: string; author: string }) =>
      post<{ project: ProjectDossier }>(`/api/projects/${id}/review`, body),
    publish: (id: string) =>
      post<{ project: ProjectDossier; transactions: Record<string, unknown> }>(`/api/projects/${id}/publish`),

    addEvidence: (id: string, body: Record<string, unknown>) =>
      post<{ evidence: Evidence }>(`/api/projects/${id}/evidence`, body),
    bundle: (id: string, milestoneIndex: number) =>
      get<{ bundleHash: string; evidence: Evidence[] }>(`/api/projects/${id}/evidence/${milestoneIndex}/bundle`),

    milestoneReview: (id: string, index: number) =>
      get<MilestoneReview>(`/api/projects/${id}/milestones/${index}/review`),
    attest: (id: string, index: number, body: { approved: boolean; verifierKey: string }) =>
      post<{ attestation: StoredAttestation }>(`/api/projects/${id}/milestones/${index}/attest`, body),
    expire: (id: string) => post<{ txHash: string }>(`/api/projects/${id}/expire`),
  },

  attestations: {
    submit: (digest: string) =>
      post<{ txHash: string; blockNumber: number; status: string }>(`/api/attestations/${digest}/submit`),
  },

  investors: {
    list: () => get<{ investors: Investor[] }>('/api/investors'),
    detail: (address: string) =>
      get<{ investor: Investor; credentials: unknown[] }>(`/api/investors/${address}`),
    register: (body: { address: string; displayName: string; email: string }) =>
      post<{ investor: Investor }>('/api/investors', body),
    setKyc: (address: string, approved: boolean) =>
      post<{ investor: Investor; txHash: string }>(`/api/investors/${address}/kyc`, { approved }),
    issueCredential: (address: string, body: { jurisdiction: number; netWorth: string; expiresAt: number }) =>
      post<{ credential: { leaf: string }; secret: IssuedCredentialSecret; issuerRoot: string }>(
        `/api/investors/${address}/credential`, body),
  },

  issuer: {
    root: () => get<{ root: string; credentials: number }>('/api/issuer/root'),
    path: (leaf: string) => get<MerklePathResponse>(`/api/issuer/path/${leaf}`),
  },

  /** El circuito compilado. Se sirve desde el backend para que SIEMPRE sea el
   *  mismo con el que se generó el verificador desplegado. */
  circuit: () => get<{ bytecode: string; abi: unknown }>('/api/circuit/eligibility'),
}
