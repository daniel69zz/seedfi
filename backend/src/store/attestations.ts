// ---------------------------------------------------------------------------
//  Attestations — la firma del verificador
// ---------------------------------------------------------------------------
//
//  Separar FIRMAR de TRANSMITIR es deliberado y es lo que hace que el sistema
//  no dependa de que este servidor esté vivo.
//
//  El verificador firma una attestation EIP-712; queda guardada acá. Mandarla al
//  contrato puede hacerlo cualquiera —el desarrollador, un inversionista, un
//  script—: `releaseMilestone` autoriza por la FIRMA, no por el remitente. Si
//  Seed 2 Deed desaparece mañana, una attestation ya firmada sigue liberando su
//  tramo. Este backend es una comodidad, no una llave.

import { randomBytes } from 'node:crypto';
import type { Hex } from 'viem';
import { db, now } from '../db.ts';
import { DomainError, getProject, evidenceBundleHash } from './projects.ts';
import { signAttestation, type AttestationMessage } from '../chain.ts';

export interface StoredAttestation {
  digest: string;
  projectId: string;
  milestoneIndex: number;
  evidenceHash: string;
  approved: boolean;
  nonce: string;
  expiresAt: number;
  signature: string;
  signer: string;
  signedAt: string;
  submittedTx: string | null;
}

/** Cuánto vive una firma antes de caducar. Una firma sin vencimiento es una
 *  firma eterna: si el verificador después se arrepiente, ya no puede hacer
 *  nada salvo `revoke`, y eso exige que alguien esté mirando. */
const VIGENCIA_FIRMA_SEGUNDOS = 7 * 24 * 60 * 60;

export async function createAttestation(input: {
  projectId: string;
  milestoneIndex: number;
  approved: boolean;
  verifierKey: Hex;
  ttlSeconds?: number;
}): Promise<StoredAttestation> {
  const project = getProject(input.projectId);
  if (!project) throw new DomainError('Proyecto inexistente', 404);

  const milestone = project.milestones.find((m) => m.index === input.milestoneIndex);
  if (!milestone) throw new DomainError(`El proyecto no tiene un hito ${input.milestoneIndex}.`, 404);

  // Se firma el hash del paquete de evidencia, no un texto libre. Sin esto, el
  // verificador firma "apruebo el hito 3" y después nadie puede demostrar
  // contra qué firmó.
  const evidenceHash = evidenceBundleHash(project.id, input.milestoneIndex);

  const message: AttestationMessage = {
    projectId: BigInt(project.onChainId),
    milestoneIndex: input.milestoneIndex,
    evidenceHash: evidenceHash as Hex,
    approved: input.approved,
    // Nonce aleatorio de 256 bits: dos firmas del mismo hito con la misma
    // evidencia dan digests distintos, así que una firma revocada no bloquea
    // la siguiente.
    nonce: BigInt(`0x${randomBytes(32).toString('hex')}`),
    expiresAt: BigInt(Math.floor(Date.now() / 1000) + (input.ttlSeconds ?? VIGENCIA_FIRMA_SEGUNDOS)),
  };

  const { signature, signer, digest } = await signAttestation(input.verifierKey, message);

  const authorized = project.verifiers.find((v) => v.address.toLowerCase() === signer.toLowerCase());
  if (!authorized) {
    throw new DomainError(
      `La wallet ${signer} no figura como verificador de este proyecto. El contrato la rechazaría de todas formas; se corta acá para no gastar gas.`,
      403,
    );
  }
  if (authorized.role !== milestone.role) {
    throw new DomainError(
      `El hito ${input.milestoneIndex} exige un verificador ${milestone.role} y ${signer} está registrado como ${authorized.role}. Un abogado no acredita avance de obra.`,
      403,
    );
  }

  const record: StoredAttestation = {
    digest, projectId: project.id, milestoneIndex: input.milestoneIndex,
    evidenceHash, approved: input.approved,
    nonce: message.nonce.toString(), expiresAt: Number(message.expiresAt),
    signature, signer, signedAt: now(), submittedTx: null,
  };

  db().prepare(
    `INSERT INTO attestations (digest,project_id,milestone_index,evidence_hash,approved,nonce,expires_at,signature,signer,signed_at,submitted_tx)
     VALUES (?,?,?,?,?,?,?,?,?,?,NULL)`,
  ).run(record.digest, record.projectId, record.milestoneIndex, record.evidenceHash,
        record.approved ? 1 : 0, record.nonce, record.expiresAt, record.signature,
        record.signer, record.signedAt);

  return record;
}

export function listAttestations(projectId: string, milestoneIndex?: number): StoredAttestation[] {
  const rows = milestoneIndex === undefined
    ? db().prepare('SELECT * FROM attestations WHERE project_id = ? ORDER BY milestone_index, signed_at').all(projectId)
    : db().prepare('SELECT * FROM attestations WHERE project_id = ? AND milestone_index = ? ORDER BY signed_at').all(projectId, milestoneIndex);
  return (rows as unknown as Record<string, never>[]).map(toAttestation);
}

export function getAttestation(digest: string): StoredAttestation | null {
  const row = db().prepare('SELECT * FROM attestations WHERE digest = ?').get(digest);
  return row ? toAttestation(row as never) : null;
}

export function markSubmitted(digest: string, txHash: string): void {
  db().prepare('UPDATE attestations SET submitted_tx = ? WHERE digest = ?').run(txHash, digest);
}

function toAttestation(r: Record<string, never>): StoredAttestation {
  return {
    digest: r.digest, projectId: r.project_id, milestoneIndex: r.milestone_index,
    evidenceHash: r.evidence_hash, approved: Boolean(r.approved), nonce: r.nonce,
    expiresAt: r.expires_at, signature: r.signature, signer: r.signer,
    signedAt: r.signed_at, submittedTx: r.submitted_tx,
  } as unknown as StoredAttestation;
}
