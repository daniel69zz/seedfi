// ---------------------------------------------------------------------------
//  Credenciales KYC y el árbol del emisor
// ---------------------------------------------------------------------------
//
//  El modelo mental, en una línea:
//
//      el emisor KYC publica una RAÍZ; el inversionista guarda un SECRETO.
//
//  El emisor verifica identidad, patrimonio y residencia una sola vez, y mete
//  en su árbol una hoja que compromete esos atributos junto al secreto del
//  inversionista. Publica la raíz. Eso es todo lo que el mundo ve.
//
//  Revocar es sacar la hoja y republicar la raíz. No hace falta una lista de
//  revocación ni una prueba de no-pertenencia: si la hoja no está, la prueba
//  de inclusión no cierra. Es el mismo mecanismo para "emitida" y para "no
//  revocada", que es lo que lo hace difícil de romper por descuido.

import { poseidon2, hashPair } from './poseidon.js';
import { addressToField } from './field.js';

/** Profundidad fija del árbol. Tiene que ser IDÉNTICA a `TREE_DEPTH` en Noir. */
export const TREE_DEPTH = 8;
export const TREE_CAPACITY = 2 ** TREE_DEPTH;

/** Códigos ISO-3166 numéricos de las jurisdicciones que la plataforma admite. */
export const JURISDICTIONS = { BO: 68, AR: 32, BR: 76, CL: 152, PE: 604, US: 840, ES: 724 } as const;

export interface Credential {
  /** Secreto del titular. NUNCA sale de su dispositivo. */
  secret: bigint;
  /** ISO-3166 numérico de residencia. */
  jurisdiction: number;
  /** Patrimonio declarado y verificado por el emisor, en unidades enteras. */
  netWorth: bigint;
  /** Vencimiento, unix seconds. Un KYC de 2019 no dice nada de hoy. */
  expiresAt: number;
}

/** La hoja compromete los cuatro atributos: cambiar uno produce otra hoja. */
export function credentialLeaf(c: Credential): bigint {
  return poseidon2([c.secret, BigInt(c.jurisdiction), c.netWorth, BigInt(c.expiresAt)]);
}

/**
 * Nullifier: marca de un solo uso por (credencial, proyecto, wallet).
 *
 * Determinista para un mismo trío, así que el contrato puede quemarlo; y sin
 * el secreto no hay forma de atar el nullifier del proyecto 1 con el del 2,
 * así que no sirve para seguirle el rastro a nadie entre rondas.
 */
export function computeNullifier(secret: bigint, projectId: number | bigint, investor: string): bigint {
  return poseidon2([secret, BigInt(projectId), addressToField(investor)]);
}

export interface MerkleProof {
  root: bigint;
  path: bigint[];
  indexBits: boolean[];
  leaf: bigint;
  index: number;
}

/**
 * Árbol de Merkle de profundidad fija. Las posiciones vacías valen 0, igual que
 * en el circuito: el `fixture` de los tests de Noir hashea contra ceros y tiene
 * que dar la misma raíz que esta clase.
 */
export class CredentialTree {
  private readonly leaves: bigint[];

  constructor(leaves: bigint[] = []) {
    if (leaves.length > TREE_CAPACITY) {
      throw new Error(`el arbol admite ${TREE_CAPACITY} credenciales, se pasaron ${leaves.length}`);
    }
    this.leaves = [...leaves];
  }

  /** @returns el índice de la hoja insertada. */
  insert(leaf: bigint): number {
    if (this.leaves.length >= TREE_CAPACITY) throw new Error('arbol lleno');
    this.leaves.push(leaf);
    return this.leaves.length - 1;
  }

  /** Revocar = sacar la hoja. Se pone en 0 en vez de compactar: mover las
   *  demás invalidaría los caminos de todos los otros titulares. */
  revokeAt(index: number): void {
    if (index < 0 || index >= this.leaves.length) throw new Error('indice fuera de rango');
    this.leaves[index] = 0n;
  }

  indexOf(leaf: bigint): number {
    return this.leaves.findIndex((l) => l === leaf);
  }

  get size(): number {
    return this.leaves.length;
  }

  /** Recalcula el árbol entero. Con 256 hojas son 255 hashes: no vale la pena
   *  cachear nada y arriesgarse a servir una raíz desactualizada. */
  private levels(): bigint[][] {
    const bottom: bigint[] = new Array(TREE_CAPACITY).fill(0n);
    for (let i = 0; i < this.leaves.length; i++) bottom[i] = this.leaves[i]!;

    const levels: bigint[][] = [bottom];
    for (let d = 0; d < TREE_DEPTH; d++) {
      const prev = levels[d]!;
      const next: bigint[] = [];
      for (let i = 0; i < prev.length; i += 2) {
        next.push(hashPair(prev[i]!, prev[i + 1]!));
      }
      levels.push(next);
    }
    return levels;
  }

  root(): bigint {
    return this.levels()[TREE_DEPTH]![0]!;
  }

  /** Camino de autenticación de la hoja en `index`. */
  proofAt(index: number): MerkleProof {
    if (index < 0 || index >= TREE_CAPACITY) throw new Error('indice fuera de rango');
    const levels = this.levels();
    const path: bigint[] = [];
    const indexBits: boolean[] = [];

    let i = index;
    for (let d = 0; d < TREE_DEPTH; d++) {
      const isRight = (i & 1) === 1;
      const siblingIndex = isRight ? i - 1 : i + 1;
      path.push(levels[d]![siblingIndex]!);
      // `true` = la hoja va a la derecha, el hermano a la izquierda.
      indexBits.push(isRight);
      i >>= 1;
    }

    return { root: levels[TREE_DEPTH]![0]!, path, indexBits, leaf: levels[0]![index]!, index };
  }

  proofFor(credential: Credential): MerkleProof {
    const leaf = credentialLeaf(credential);
    const index = this.indexOf(leaf);
    if (index === -1) {
      throw new Error('la credencial no esta en el arbol del emisor: fue revocada o nunca se emitio');
    }
    return this.proofAt(index);
  }
}
