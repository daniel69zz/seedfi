// ---------------------------------------------------------------------------
//  Poseidon2 — el mismo hash que usa el circuito, del lado de TypeScript
// ---------------------------------------------------------------------------
//
//  El árbol de credenciales se arma en el servidor (o en el navegador) y se
//  verifica dentro del circuito. Si las dos implementaciones de Poseidon2 no
//  coinciden BIT POR BIT, ninguna prueba valida jamás y el error que se ve es
//  un `assert` genérico que no dice nada.
//
//  Por eso no se reimplementa Poseidon acá: se llama a la misma barretenberg
//  que Noir usa por debajo a través del blackbox `poseidon2_permutation`. Una
//  sola implementación, cero chance de divergir.

import { BarretenbergSync } from '@aztec/bb.js';
import { toBytes32, fromBytes } from './field.js';

let sync: BarretenbergSync | null = null;

/** Inicializa el WASM una sola vez. Cuesta ~1 s; conviene no repetirlo. */
export async function initPoseidon(): Promise<void> {
  if (!sync) sync = await BarretenbergSync.new();
}

export function poseidon2(inputs: bigint[]): bigint {
  if (!sync) throw new Error('llamá a initPoseidon() antes de hashear');
  const { hash } = sync.poseidon2Hash({ inputs: inputs.map(toBytes32) });
  return fromBytes(hash);
}

/** Compresión 2→1 para nodos de Merkle. El orden importa: hash(a,b) ≠ hash(b,a). */
export function hashPair(left: bigint, right: bigint): bigint {
  return poseidon2([left, right]);
}
