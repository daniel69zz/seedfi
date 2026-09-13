// ---------------------------------------------------------------------------
//  SeedFi — esquema de datos del Project Dossier   (backlog T1)
// ---------------------------------------------------------------------------
//
//  El dossier es el expediente del proyecto: lo que un comité de crédito
//  necesita ver antes de dejar que alguien ponga plata. No es el formulario de
//  un marketplace.
//
//  Hay una regla que atraviesa todo el archivo y conviene decirla de entrada:
//
//      EL DINERO SE MIDE EN ENTEROS, SIEMPRE.
//
//  Todo monto vive en unidades mínimas del stablecoin (USDT: 6 decimales), como
//  `bigint` serializado a string en el transporte. Ni un solo `number` para
//  dinero. Un `number` de JS es un double: 0.1 + 0.2 !== 0.3, y un capital de
//  nueve cifras con seis decimales ya no cabe exacto en un double. El monto que
//  la UI muestra tiene que ser, bit por bit, el que el contrato transfiere;
//  cualquier otra cosa termina en un descuadre que nadie sabe explicar.
//
//  La otra regla: los porcentajes van en puntos básicos (bps, 1 % = 100) para
//  que casen exactamente con `ProjectVault.Milestone.bps` y con los topes de
//  comisión grabados en el bytecode.

/** Monto en unidades mínimas del stablecoin, serializado como string decimal. */
export type Amount = string;

/** Puntos básicos. 10_000 = 100 %. */
export type Bps = number;

/** ISO-8601 en UTC. */
export type Timestamp = string;

// ---------------------------------------------------------------- ciclo de vida

/**
 * Estados del proyecto. El orden importa: el dossier solo avanza hacia adelante
 * salvo por `CHANGES_REQUESTED`, que devuelve a la constructora al tablero.
 *
 * Los cinco últimos son espejo de `ProjectVault.Status` on-chain; los primeros
 * son de la plataforma, porque la cadena no sabe nada de due diligence.
 */
export type ProjectStatus =
  | 'DRAFT'              // la constructora lo está redactando
  | 'SUBMITTED'          // entregado a la plataforma
  | 'UNDER_REVIEW'       // due diligence en curso
  | 'CHANGES_REQUESTED'  // devuelto con observaciones
  | 'REJECTED'           // no pasa
  | 'APPROVED'           // pasa due diligence, todavía sin vault
  | 'PUBLISHED'          // vault desplegado, visible en el marketplace
  | 'FUNDING'            // ronda abierta          → Status.FUNDING
  | 'ACTIVE'             // meta alcanzada         → Status.ACTIVE
  | 'COMPLETED'          // hitos liberados        → Status.COMPLETED
  | 'ROUND_FAILED'       // no llegó a la meta     → Status.ROUND_FAILED
  | 'MILESTONE_FAILED';  // hito fallido, capital congelado → Status.MILESTONE_FAILED

/** Estados desde los cuales el proyecto todavía puede editarse. */
export const EDITABLE_STATUSES: readonly ProjectStatus[] = ['DRAFT', 'CHANGES_REQUESTED'];

/** Estados en los que el proyecto ya tiene capital de terceros comprometido. */
export const CAPITAL_AT_RISK_STATUSES: readonly ProjectStatus[] = [
  'FUNDING', 'ACTIVE', 'COMPLETED', 'MILESTONE_FAILED',
];

// ---------------------------------------------------------------------- actores

export type UserRole = 'INVESTOR' | 'DEVELOPER' | 'VERIFIER' | 'OPERATOR';

/**
 * Rol del verificador, espejo de `ProjectVault.Role`. Los valores numéricos NO
 * son cosméticos: van tal cual al contrato al registrar un hito.
 */
export const VerifierRole = { NONE: 0, LEGAL: 1, SUPERVISOR: 2 } as const;
export type VerifierRoleName = Exclude<keyof typeof VerifierRole, 'NONE'>;

export interface Verifier {
  id: string;
  /** Wallet que firma las attestations EIP-712. Nunca es la del operador. */
  address: string;
  name: string;
  role: VerifierRoleName;
  /** Matrícula profesional: el respaldo fuera de la cadena de su firma. */
  license: string;
  organization: string;
}

// ----------------------------------------------------------------------- SPV

/**
 * El vehículo legal del proyecto. Existe para que el inversionista tenga un
 * patrimonio separado contra el cual reclamar: si la constructora quiebra por
 * otra obra, este proyecto no se va con ella.
 */
export interface Spv {
  legalName: string;
  /** NIT boliviano. */
  taxId: string;
  /** Matrícula de comercio. */
  commercialRegistry: string;
  incorporatedAt: Timestamp;
  jurisdiction: string;
  /** Wallet del SPV: destinataria de los desembolsos por hito. */
  treasuryAddress: string;
}

// ------------------------------------------------------------------ inmueble

export interface PropertyRecord {
  /** Matrícula de Derechos Reales (folio real). */
  cadastralId: string;
  address: string;
  city: string;
  /** m² de terreno. */
  landArea: number;
  /** m² construibles según uso de suelo. */
  buildableArea: number;
  titleHolder: string;
  /** Tasación declarada. */
  appraisedValue: Amount;
  appraisedAt: Timestamp;
  appraiser: string;
  /**
   * Gravámenes vigentes. Una lista vacía NO significa "limpio": significa
   * "nadie declaró ninguno". La diferencia la marca `certificateVerifiedAt`.
   */
  encumbrances: Encumbrance[];
  /** Fecha del certificado de gravámenes que la plataforma efectivamente vio. */
  certificateVerifiedAt: Timestamp | null;
}

export interface Encumbrance {
  type: 'HIPOTECA' | 'ANOTACION_PREVENTIVA' | 'SERVIDUMBRE' | 'EMBARGO' | 'OTRO';
  holder: string;
  amount: Amount;
  /** Prioridad registral: 1 es el primer acreedor en cobrar. */
  rank: number;
  registeredAt: Timestamp;
}

// ------------------------------------------------------------------- finanzas

/**
 * Fuentes y usos. La invariante que sostiene todo el modelo financiero es que
 * cuadren: si las fuentes no cubren los usos, el proyecto tiene un hueco que
 * alguien va a tener que tapar, y ese alguien termina siendo el inversionista.
 * `validateDossier` lo verifica; no es decorativo.
 */
export interface SourcesAndUses {
  sources: {
    developerEquity: Amount;
    /** Lo que se le pide a la plataforma: el `target` del vault. */
    investorFinancing: Amount;
    bankFinancing: Amount;
    presales: Amount;
  };
  uses: {
    land: Amount;
    construction: Amount;
    permitsAndFees: Amount;
    professionalServices: Amount;
    marketing: Amount;
    contingency: Amount;
    financialCosts: Amount;
  };
}

export interface FinancialTerms {
  /** Meta de la ronda. Igual a `sources.investorFinancing`. */
  target: Amount;
  minimumTicket: Amount;
  maximumTicket: Amount | null;
  termMonths: number;
  /** Retorno anual ofrecido, en bps. 12 % = 1200. */
  interestBps: Bps;
  repaymentModel: 'BULLET' | 'QUARTERLY_INTEREST' | 'ON_SALE';
  /** Comisión de originación sobre cada tramo. Tope duro: 300 bps. */
  originationBps: Bps;
  /** Comisión de éxito, solo sobre el retorno. Tope duro: 2000 bps. */
  successBps: Bps;
  expectedRevenue: Amount;
  /** Cierre de la ronda. Pasado esto sin llegar a la meta, hay reembolso. */
  fundingDeadline: Timestamp;
}

// --------------------------------------------------------------------- hitos

/**
 * Un hito del dossier. `bps` es la porción del capital RECAUDADO que se libera
 * al acreditarlo, y la suma de todos tiene que dar exactamente 10 000: el
 * contrato lo rechaza si no.
 */
export interface MilestoneSpec {
  index: number;
  title: string;
  description: string;
  bps: Bps;
  /** Qué rol tiene que firmar. Un abogado no acredita avance de obra. */
  role: VerifierRoleName;
  /** Vencido sin acreditar, cualquiera puede congelar el capital restante. */
  deadline: Timestamp;
  /** Qué evidencia se exige. Se pacta ANTES, no cuando toca cobrar. */
  requiredEvidence: string[];
}

export type MilestoneState =
  | 'PENDING'    // todavía no le toca
  | 'IN_REVIEW'  // evidencia subida, verificador mirando
  | 'RELEASED'   // acreditado y desembolsado
  | 'REJECTED'   // el verificador dijo que no
  | 'EXPIRED';   // venció sin acreditar

// ------------------------------------------------------------------ evidencia

/**
 * Evidencia del mundo real. El archivo vive fuera de la cadena; lo único que
 * sube on-chain es `sha256`, dentro de la attestation firmada.
 *
 * Ese hash es lo que hace que la firma signifique algo: sin él, el verificador
 * firma "apruebo el hito 3" y después nadie puede demostrar CONTRA QUÉ firmó.
 * Con él, cambiar una foto del informe invalida la acreditación entera.
 */
export interface Evidence {
  id: string;
  projectId: string;
  milestoneIndex: number;
  kind: 'INFORME' | 'FOTOGRAFIA' | 'FACTURA' | 'CERTIFICADO' | 'PLANO' | 'CONTRATO' | 'OTRO';
  filename: string;
  contentType: string;
  sizeBytes: number;
  /** sha256 del archivo, hex con 0x. Lo que termina firmado. */
  sha256: string;
  /** CID de IPFS si se ancló ahí. */
  ipfsCid: string | null;
  uploadedBy: string;
  uploadedAt: Timestamp;
  notes: string;
}

// --------------------------------------------------------------- attestation

/** Espejo exacto de `ProjectVault.Attestation`. Lo que el verificador firma. */
export interface Attestation {
  projectId: string;
  milestoneIndex: number;
  /** Hash del paquete de evidencia (ver `evidenceBundleHash`). */
  evidenceHash: string;
  approved: boolean;
  nonce: string;
  /** Unix seconds. Una firma que no vence es una firma eterna. */
  expiresAt: number;
}

export interface SignedAttestation {
  attestation: Attestation;
  /** Firma EIP-712 de 65 bytes. */
  signature: string;
  signer: string;
  signedAt: Timestamp;
  /** Digest EIP-712. Sirve para revocar antes de que se use. */
  digest: string;
}

// ------------------------------------------------------------------ riesgo

/**
 * Score de riesgo. Los pesos son los del documento general (§36) y suman 100.
 * Cada dimensión se puntúa de 0 a 100.
 */
export const RISK_WEIGHTS = {
  legal: 20,
  financial: 20,
  developer: 15,
  market: 15,
  property: 15,
  construction: 10,
  liquidity: 5,
} as const;

export type RiskDimension = keyof typeof RISK_WEIGHTS;
export type RiskGrade = 'A+' | 'A' | 'B' | 'C' | 'D';

export interface RiskAssessment {
  scores: Record<RiskDimension, number>;
  /** Promedio ponderado, 0-100. */
  total: number;
  grade: RiskGrade;
  rationale: string;
  assessedAt: Timestamp;
  assessedBy: string;
}

// ------------------------------------------------------------- elegibilidad

/** Condiciones que el inversionista debe probar en ZK para entrar a la ronda. */
export interface EligibilityPolicy {
  /** Patrimonio mínimo, en la misma unidad que la credencial. */
  minNetWorth: string;
  /** ISO-3166 numérico. Bolivia = 68. */
  allowedJurisdiction: number;
  /** Raíz del árbol de credenciales vigentes del emisor KYC. */
  credentialRoot: string;
}

// ---------------------------------------------------------------- el dossier

export interface ProjectDossier {
  id: string;
  /** Id numérico usado on-chain. Uno solo, estable, nunca reutilizado. */
  onChainId: number;
  name: string;
  city: string;
  type: 'RESIDENCIAL' | 'COMERCIAL' | 'MIXTO' | 'INDUSTRIAL' | 'URBANIZACION';
  summary: string;
  status: ProjectStatus;

  developer: {
    id: string;
    legalName: string;
    taxId: string;
    /** Wallet de la constructora. Destinataria de los tramos liberados. */
    address: string;
    completedProjects: number;
    yearsActive: number;
  };

  spv: Spv;
  property: PropertyRecord;
  sourcesAndUses: SourcesAndUses;
  terms: FinancialTerms;
  milestones: MilestoneSpec[];
  eligibility: EligibilityPolicy;
  risk: RiskAssessment | null;

  /** Verificadores habilitados para este proyecto. */
  verifiers: Verifier[];

  /** Hash del contrato de inversión firmado fuera de la cadena. */
  agreementHash: string | null;
  agreementVersion: string | null;

  /** Dirección del vault una vez desplegado. */
  vaultAddress: string | null;
  chainId: number | null;

  createdAt: Timestamp;
  updatedAt: Timestamp;
  publishedAt: Timestamp | null;
}

// ------------------------------------------------------------------ helpers

export const USDT_DECIMALS = 6;

/** Suma montos sin pasar jamás por punto flotante. */
export function sumAmounts(...amounts: Amount[]): Amount {
  return amounts.reduce((acc, a) => acc + BigInt(a), 0n).toString();
}

export function totalSources(su: SourcesAndUses): Amount {
  const s = su.sources;
  return sumAmounts(s.developerEquity, s.investorFinancing, s.bankFinancing, s.presales);
}

export function totalUses(su: SourcesAndUses): Amount {
  const u = su.uses;
  return sumAmounts(u.land, u.construction, u.permitsAndFees, u.professionalServices, u.marketing, u.contingency, u.financialCosts);
}

export function riskGradeFor(total: number): RiskGrade {
  if (total >= 85) return 'A+';
  if (total >= 70) return 'A';
  if (total >= 55) return 'B';
  if (total >= 40) return 'C';
  return 'D';
}

export function computeRiskTotal(scores: Record<RiskDimension, number>): number {
  let acc = 0;
  for (const [dim, weight] of Object.entries(RISK_WEIGHTS) as [RiskDimension, number][]) {
    acc += scores[dim] * weight;
  }
  return Math.round(acc / 100);
}

/** Formatea para mostrar. Solo para la UI: nunca vuelve a entrar al dominio. */
export function formatAmount(amount: Amount, decimals = USDT_DECIMALS): string {
  const value = BigInt(amount);
  const base = 10n ** BigInt(decimals);
  const whole = value / base;
  const frac = (value % base).toString().padStart(decimals, '0').slice(0, 2);
  return `${whole.toLocaleString('es-BO')}.${frac}`;
}

/** Convierte "250000.50" a unidades mínimas sin tocar punto flotante. */
export function parseAmount(input: string, decimals = USDT_DECIMALS): Amount {
  const trimmed = input.trim().replace(/,/g, '');
  if (!/^\d+(\.\d+)?$/.test(trimmed)) throw new Error(`monto invalido: ${input}`);
  const [whole = '0', frac = ''] = trimmed.split('.');
  if (frac.length > decimals) throw new Error(`el monto excede ${decimals} decimales`);
  return (BigInt(whole) * 10n ** BigInt(decimals) + BigInt(frac.padEnd(decimals, '0') || '0')).toString();
}
