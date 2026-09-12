// ---------------------------------------------------------------------------
//  Aritmética de campo — el pegamento entre Noir, la EVM y JavaScript
// ---------------------------------------------------------------------------
//
//  Tres sistemas que representan el mismo número de tres maneras distintas:
//
//    Noir    Field (elemento de BN254, ~254 bits)
//    EVM     bytes32 (big-endian, 256 bits)
//    bb.js   Uint8Array de 32 bytes (big-endian)
//
//  Casi todo bug de integración ZK vive en estas conversiones: un byte al
//  revés, un hex sin padear, un número que pasó por `Number` y perdió precisión.
//  Por eso está todo acá, en un módulo chico y probado, en vez de repetido.

/** Módulo del campo escalar de BN254. */
export const FIELD_MODULUS =
  21888242871839275222246405745257275088548364400416034343698204186575808495617n;

export type Hex = `0x${string}`;

export function toHex32(value: bigint): Hex {
  if (value < 0n) throw new Error('no hay valores negativos en el campo');
  if (value >= FIELD_MODULUS) throw new Error(`el valor no cabe en el campo BN254: ${value}`);
  return `0x${value.toString(16).padStart(64, '0')}`;
}

export function toBytes32(value: bigint): Uint8Array {
  const out = new Uint8Array(32);
  let v = value;
  // Big-endian, llenando desde el final. Al revés, bb.js lee otro número.
  for (let i = 31; i >= 0; i--) {
    out[i] = Number(v & 0xffn);
    v >>= 8n;
  }
  if (v !== 0n) throw new Error('el valor excede 32 bytes');
  return out;
}

export function fromBytes(bytes: Uint8Array): bigint {
  let v = 0n;
  for (const b of bytes) v = (v << 8n) | BigInt(b);
  return v;
}

export function fromHex(hex: string): bigint {
  return BigInt(hex.startsWith('0x') ? hex : `0x${hex}`);
}

/** Una dirección EVM como elemento de campo. Entran de sobra: 160 < 254 bits. */
export function addressToField(address: string): bigint {
  const clean = address.toLowerCase().replace(/^0x/, '');
  if (!/^[0-9a-f]{40}$/.test(clean)) throw new Error(`direccion invalida: ${address}`);
  return BigInt(`0x${clean}`);
}

/** Bytes crudos a hex, para armar el `proof` que espera Solidity. */
export function bytesToHex(bytes: Uint8Array): Hex {
  let s = '';
  for (const b of bytes) s += b.toString(16).padStart(2, '0');
  return `0x${s}`;
}
