// ---------------------------------------------------------------------------
//  Inversionistas, credenciales KYC y el árbol del emisor
// ---------------------------------------------------------------------------
//
//  Acá está la parte incómoda de hacer bien la privacidad: el emisor tiene que
//  VER los datos para verificarlos, y después tiene que NO GUARDARLOS.
//
//  Cuando se emite una credencial, el backend recibe jurisdicción, patrimonio y
//  vencimiento, calcula la hoja, la inserta en el árbol… y se queda únicamente
//  con la hoja. El secreto y los atributos se devuelven UNA sola vez, en la
//  respuesta, y el titular los guarda. Si se pierden, se re-emite; no hay
//  recuperación, y eso es la propiedad, no el defecto: lo que el servidor no
//  tiene no se le puede filtrar, ni pedir por orden judicial, ni vender.

import { randomUUID, randomBytes } from 'node:crypto';
import { CredentialTree, credentialLeaf, type Credential, JURISDICTIONS, FIELD_MODULUS } from '@s2d/zk';
import { db, now } from '../db.ts';
import { DomainError } from './projects.ts';

export interface Investor {
  id: string;
  address: string;
  displayName: string;
  email: string;
  kycStatus: 'PENDING' | 'APPROVED' | 'REJECTED';
  kycSyncedAt: string | null;
  createdAt: string;
}

function toInvestor(r: Record<string, never>): Investor {
  return {
    id: r.id, address: r.address, displayName: r.display_name, email: r.email,
    kycStatus: r.kyc_status, kycSyncedAt: r.kyc_synced_at, createdAt: r.created_at,
  } as unknown as Investor;
}

export function upsertInvestor(input: { address: string; displayName: string; email: string }): Investor {
  const address = input.address.toLowerCase();
  const existing = db().prepare('SELECT * FROM investors WHERE address = ?').get(address);
  if (existing) return toInvestor(existing as never);

  const investor: Investor = {
    id: randomUUID(), address, displayName: input.displayName, email: input.email,
    kycStatus: 'PENDING', kycSyncedAt: null, createdAt: now(),
  };
  db().prepare('INSERT INTO investors (id,address,display_name,email,kyc_status,kyc_synced_at,created_at) VALUES (?,?,?,?,?,?,?)')
    .run(investor.id, investor.address, investor.displayName, investor.email, investor.kycStatus, null, investor.createdAt);
  return investor;
}

export function getInvestorByAddress(address: string): Investor | null {
  const row = db().prepare('SELECT * FROM investors WHERE address = ?').get(address.toLowerCase());
  return row ? toInvestor(row as never) : null;
}

export function listInvestors(): Investor[] {
  return db().prepare('SELECT * FROM investors ORDER BY created_at DESC').all().map((r) => toInvestor(r as never));
}

export function setKycStatus(address: string, status: Investor['kycStatus'], syncedAt?: string): Investor {
  const investor = getInvestorByAddress(address);
  if (!investor) throw new DomainError('Inversionista no registrado', 404);
  db().prepare('UPDATE investors SET kyc_status = ?, kyc_synced_at = ? WHERE id = ?')
    .run(status, syncedAt ?? investor.kycSyncedAt, investor.id);
  return { ...investor, kycStatus: status, kycSyncedAt: syncedAt ?? investor.kycSyncedAt };
}

// ------------------------------------------------------------- credenciales

export interface IssuedCredential {
  id: string;
  investorId: string;
  leafIndex: number;
  leaf: string;
  issuedAt: string;
  expiresAt: number;
  revokedAt: string | null;
}

/** Lo que se devuelve UNA vez y no se guarda. */
export interface CredentialSecret {
  secret: string;
  jurisdiction: number;
  netWorth: string;
  expiresAt: number;
}

/** Reconstruye el árbol desde las hojas vigentes. */
export function issuerTree(): CredentialTree {
  const rows = db().prepare('SELECT leaf_index, leaf, revoked_at FROM credentials ORDER BY leaf_index')
    .all() as unknown as { leaf_index: number; leaf: string; revoked_at: string | null }[];

  const tree = new CredentialTree();
  for (const row of rows) {
    // Revocada = hoja en cero. No se compacta el array: mover las demás
    // invalidaría el camino de autenticación de todos los otros titulares.
    tree.insert(row.revoked_at ? 0n : BigInt(row.leaf));
  }
  return tree;
}

export function issuerRoot(): string {
  return `0x${issuerTree().root().toString(16).padStart(64, '0')}`;
}

/**
 * Emite una credencial. El secreto se genera acá SOLO para la demo: en
 * producción lo genera el dispositivo del titular y el emisor recibe un
 * compromiso, para que ni siquiera en el momento de la emisión el servidor vea
 * el secreto.
 */
export function issueCredential(input: {
  investorId: string;
  jurisdiction: number;
  netWorth: bigint;
  expiresAt: number;
  secret?: bigint;
}): { credential: IssuedCredential; secret: CredentialSecret } {
  const investor = db().prepare('SELECT * FROM investors WHERE id = ?').get(input.investorId);
  if (!investor) throw new DomainError('Inversionista no registrado', 404);

  if (!Object.values(JURISDICTIONS).includes(input.jurisdiction as never)) {
    throw new DomainError(`Jurisdicción ${input.jurisdiction} no soportada. Admitidas: ${Object.entries(JURISDICTIONS).map(([k, v]) => `${k}=${v}`).join(', ')}`, 400);
  }
  if (input.expiresAt <= Math.floor(Date.now() / 1000)) {
    throw new DomainError('No se emite una credencial ya vencida.', 400);
  }

  const secret = input.secret ?? randomFieldElement();
  const credential: Credential = {
    secret, jurisdiction: input.jurisdiction, netWorth: input.netWorth, expiresAt: input.expiresAt,
  };
  const leaf = credentialLeaf(credential);

  const leafIndex = db().prepare('SELECT COUNT(*) AS c FROM credentials').get() as { c: number };
  const record: IssuedCredential = {
    id: randomUUID(), investorId: input.investorId, leafIndex: leafIndex.c,
    leaf: `0x${leaf.toString(16).padStart(64, '0')}`,
    issuedAt: now(), expiresAt: input.expiresAt, revokedAt: null,
  };

  db().prepare('INSERT INTO credentials (id,investor_id,leaf_index,leaf,issued_at,expires_at,revoked_at) VALUES (?,?,?,?,?,?,NULL)')
    .run(record.id, record.investorId, record.leafIndex, record.leaf, record.issuedAt, record.expiresAt);

  saveRoot();

  return {
    credential: record,
    secret: {
      secret: `0x${secret.toString(16)}`,
      jurisdiction: input.jurisdiction,
      netWorth: input.netWorth.toString(),
      expiresAt: input.expiresAt,
    },
  };
}

export function revokeCredential(credentialId: string): void {
  const changed = db().prepare('UPDATE credentials SET revoked_at = ? WHERE id = ? AND revoked_at IS NULL')
    .run(now(), credentialId);
  if (changed.changes === 0) throw new DomainError('Credencial inexistente o ya revocada', 404);
  saveRoot();
}

export function listCredentials(investorId?: string): IssuedCredential[] {
  const rows = investorId
    ? db().prepare('SELECT * FROM credentials WHERE investor_id = ? ORDER BY leaf_index').all(investorId)
    : db().prepare('SELECT * FROM credentials ORDER BY leaf_index').all();
  return (rows as unknown as Record<string, never>[]).map((r) => ({
    id: r.id, investorId: r.investor_id, leafIndex: r.leaf_index, leaf: r.leaf,
    issuedAt: r.issued_at, expiresAt: r.expires_at, revokedAt: r.revoked_at,
  })) as unknown as IssuedCredential[];
}

/**
 * El camino de autenticación de una hoja. Es público por diseño: revela la
 * POSICIÓN en el árbol, no el contenido de la credencial. Aun así, el que lo
 * pide ya tiene que conocer su propia hoja para saber cuál pedir.
 */
export function merklePathFor(leaf: string): { root: string; path: string[]; indexBits: boolean[]; index: number } {
  const tree = issuerTree();
  const index = tree.indexOf(BigInt(leaf));
  if (index === -1) {
    throw new DomainError('Esa credencial no está en el árbol vigente: fue revocada o nunca se emitió.', 404);
  }
  const proof = tree.proofAt(index);
  return {
    root: `0x${proof.root.toString(16).padStart(64, '0')}`,
    path: proof.path.map((p) => `0x${p.toString(16).padStart(64, '0')}`),
    indexBits: proof.indexBits,
    index,
  };
}

function saveRoot(): void {
  db().prepare('INSERT INTO issuer_state (id, root, updated_at) VALUES (1, ?, ?) ON CONFLICT(id) DO UPDATE SET root=excluded.root, updated_at=excluded.updated_at')
    .run(issuerRoot(), now());
}

/** Aleatorio uniforme en el campo. El rechazo evita el sesgo del módulo. */
function randomFieldElement(): bigint {
  for (;;) {
    const candidate = BigInt(`0x${randomBytes(32).toString('hex')}`);
    if (candidate < FIELD_MODULUS && candidate !== 0n) return candidate;
  }
}
