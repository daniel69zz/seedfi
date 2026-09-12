// ---------------------------------------------------------------------------
//  Subida a IPFS vía Pinata  (backlog T18)
// ---------------------------------------------------------------------------
//
//  El hash SHA-256 de cada archivo de evidencia ya se firma en la attestation.
//  Subir a IPFS y guardar el CID agrega una capa: alguien con el CID puede
//  bajar los bytes y comprobar que el sha256 cuadra con lo firmado, SIN
//  depender de que este servidor siga en pie.
//
//  Pinata se eligió porque tiene una API HTTP plana (un POST con el archivo y
//  un JWT) y una capa gratuita generosa. Si cambiás de proveedor, lo único que
//  cambia es la URL y el header.
//
//  Si no hay `PINATA_JWT`, `pin` devuelve null sin fallar. El backend sigue
//  sirviendo la evidencia desde SQLite y el campo `ipfsCid` queda vacío en la
//  base. Es un STRETCH GOAL: el sistema funciona sin esto.

import { db } from '../db.ts';

const PINATA_API   = 'https://api.pinata.cloud/pinning/pinFileToIPFS';
const PINATA_JWT   = process.env.PINATA_JWT ?? null;

export interface PinResult {
  ipfsHash: string;     // CIDv0 o v1 — lo que Pinata devuelve
  pinSize: number;
  timestamp: string;
}

/**
 * Sube un Buffer a IPFS vía Pinata y devuelve el CID.
 *
 * Si no hay JWT configurado devuelve null — no falla, no bloquea. El hash
 * SHA-256 firmado sigue siendo la prueba de integridad; IPFS es conveniencia
 * adicional.
 */
export async function pin(
  content: Buffer | Uint8Array,
  filename: string,
  metadata?: Record<string, string>,
): Promise<PinResult | null> {
  if (!PINATA_JWT) return null;

  const blob = new Blob([content]);
  const formData = new FormData();
  formData.append('file', blob, filename);

  if (metadata) {
    formData.append('pinataMetadata', JSON.stringify({
      name: filename,
      keyvalues: metadata,
    }));
  }

  const response = await fetch(PINATA_API, {
    method: 'POST',
    headers: { Authorization: `Bearer ${PINATA_JWT}` },
    body: formData,
  });

  if (!response.ok) {
    const body = await response.text().catch(() => '');
    console.warn(`[ipfs] pinata respondió ${response.status}: ${body.slice(0, 200)}`);
    return null;
  }

  const result = await response.json() as { IpfsHash: string; PinSize: number; Timestamp: string };
  return {
    ipfsHash: result.IpfsHash,
    pinSize: result.PinSize,
    timestamp: result.Timestamp,
  };
}

/**
 * Sube a IPFS y actualiza el registro de evidencia con el CID.
 *
 * Se separa de `addEvidence` a propósito: el pin es asíncrono y puede fallar
 * sin que la evidencia se pierda. Primero se graba en la base (con sha256
 * correcto), y después se intenta el pin. Si falla, el registro queda con
 * `ipfs_cid = null` y se puede reintentar más tarde.
 */
export async function pinAndUpdate(evidenceId: string, content: Buffer | Uint8Array, filename: string, projectId: string): Promise<string | null> {
  const result = await pin(content, filename, {
    projectId,
    evidenceId,
  });
  if (!result) return null;

  const cid = result.ipfsHash;
  db().prepare('UPDATE evidence SET ipfs_cid = ? WHERE id = ?').run(cid, evidenceId);
  console.log(`[ipfs] ${filename} → ipfs://${cid} (${result.pinSize} bytes)`);
  return cid;
}

/**
 * Retorna la gateway URL para un CID.
 *
 * Pinata ofrece un dedicated gateway, pero el público de ipfs.io funciona para
 * verificación: la idea es que CUALQUIERA pueda bajar el archivo y comparar el
 * sha256 que se firmó.
 */
export function gatewayUrl(cid: string): string {
  const gateway = process.env.PINATA_GATEWAY ?? 'https://gateway.pinata.cloud/ipfs';
  return `${gateway}/${cid}`;
}

export function isConfigured(): boolean {
  return PINATA_JWT !== null;
}
