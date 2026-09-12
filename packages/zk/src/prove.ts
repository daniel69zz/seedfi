// ---------------------------------------------------------------------------
//  Generación de la prueba de elegibilidad
// ---------------------------------------------------------------------------
//
//  Corre igual en Node y en el navegador, y ese detalle es el punto entero del
//  diseño: la prueba se genera DONDE ESTÁ EL SECRETO, es decir en el dispositivo
//  del inversionista. Si el backend generara la prueba, el backend tendría que
//  conocer el patrimonio y la credencial, y toda la privacidad sería un adorno.
//
//  Acá se usa desde Node para el e2e y desde React para la UI (T9).

import { Noir } from '@noir-lang/noir_js';
import { Barretenberg, UltraHonkBackend } from '@aztec/bb.js';
import { type Credential, type MerkleProof, computeNullifier } from './credential.js';
import { addressToField, toHex32, bytesToHex, type Hex } from './field.js';

/** El artefacto que produce `nargo compile`. */
export interface CompiledCircuit {
  bytecode: string;
  abi: unknown;
  [key: string]: unknown;
}

export interface EligibilityInputs {
  credential: Credential;
  merkleProof: MerkleProof;
  projectId: number;
  investorAddress: string;
  minNetWorth: bigint;
  allowedJurisdiction: number;
  /** Unix seconds. El contrato exige que sea reciente (±30 min). */
  now: number;
}

export interface EligibilityProof {
  /** Bytes de la prueba, listos para `proveEligibility`. */
  proof: Hex;
  /**
   * Los 7 inputs públicos EN EL ORDEN DE `main`. Ese orden es un contrato
   * implícito entre tres archivos —el circuito, este módulo y las constantes
   * `PI_*` del registro— y no hay compilador que lo verifique. Si alguien
   * reordena la firma de `main`, esto se rompe en silencio.
   */
  publicInputs: Hex[];
  nullifier: Hex;
}

/**
 * Revisa las condiciones ANTES de gastar segundos probando.
 *
 * El circuito ya valida todo esto, pero un `assert` fallido adentro devuelve un
 * error opaco de barretenberg. Acá el inversionista se entera de que su
 * credencial venció, en castellano, en vez de mirar un stack trace de WASM.
 */
export function checkEligibilityLocally(i: EligibilityInputs): string[] {
  const problems: string[] = [];
  if (i.credential.expiresAt <= i.now) {
    problems.push(`La credencial vencio el ${new Date(i.credential.expiresAt * 1000).toISOString().slice(0, 10)}.`);
  }
  if (i.credential.jurisdiction !== i.allowedJurisdiction) {
    problems.push(`La ronda admite la jurisdiccion ${i.allowedJurisdiction} y la credencial declara ${i.credential.jurisdiction}.`);
  }
  if (i.credential.netWorth < i.minNetWorth) {
    problems.push(`La ronda exige un patrimonio minimo de ${i.minNetWorth} y la credencial acredita menos.`);
  }
  return problems;
}

/** Arma el mapa de entradas que espera el circuito, con los nombres de `main`. */
function toCircuitInputs(i: EligibilityInputs): Record<string, unknown> {
  const nullifier = computeNullifier(i.credential.secret, i.projectId, i.investorAddress);
  return {
    credential_root: toHex32(i.merkleProof.root),
    project_id: toHex32(BigInt(i.projectId)),
    investor_address: toHex32(addressToField(i.investorAddress)),
    min_net_worth: toHex32(i.minNetWorth),
    allowed_jurisdiction: toHex32(BigInt(i.allowedJurisdiction)),
    now: toHex32(BigInt(i.now)),
    nullifier: toHex32(nullifier),
    secret: toHex32(i.credential.secret),
    jurisdiction: toHex32(BigInt(i.credential.jurisdiction)),
    net_worth: toHex32(i.credential.netWorth),
    expires_at: toHex32(BigInt(i.credential.expiresAt)),
    merkle_path: i.merkleProof.path.map(toHex32),
    merkle_index_bits: i.merkleProof.indexBits,
  };
}

/**
 * Genera la prueba. Tarda unos segundos y ocupa el hilo: en el navegador va en
 * un worker, no en el hilo de UI.
 *
 * @param circuit  el `eligibility.json` de `nargo compile`
 */
export async function generateEligibilityProof(
  circuit: CompiledCircuit,
  inputs: EligibilityInputs,
): Promise<EligibilityProof> {
  const problems = checkEligibilityLocally(inputs);
  if (problems.length > 0) {
    throw new Error(`No se puede generar la prueba:\n- ${problems.join('\n- ')}`);
  }

  const noir = new Noir(circuit as never);
  const { witness } = await noir.execute(toCircuitInputs(inputs) as never);

  const api = await Barretenberg.new();
  try {
    const backend = new UltraHonkBackend(circuit.bytecode, api);
    // 'evm' = keccak como oráculo de Fiat-Shamir + ZK. Tiene que ser EXACTAMENTE
    // el mismo target con el que se generó el verificador Solidity (`bb ... -t evm`);
    // con otro, la prueba es válida pero el contrato la rechaza.
    const { proof, publicInputs } = await backend.generateProof(witness, { verifierTarget: 'evm' });

    const normalized = publicInputs.map((p) => normalizeField(p));
    if (normalized.length !== 7) {
      throw new Error(`el circuito devolvio ${normalized.length} inputs publicos y el registro espera 7`);
    }

    return {
      proof: bytesToHex(proof),
      publicInputs: normalized,
      nullifier: normalized[6]!,
    };
  } finally {
    await api.destroy();
  }
}

/** Verifica la prueba localmente, sin tocar la cadena. */
export async function verifyEligibilityProofLocally(
  circuit: CompiledCircuit,
  proof: EligibilityProof,
): Promise<boolean> {
  const api = await Barretenberg.new();
  try {
    const backend = new UltraHonkBackend(circuit.bytecode, api);
    return await backend.verifyProof(
      { proof: hexToBytes(proof.proof), publicInputs: proof.publicInputs },
      { verifierTarget: 'evm' },
    );
  } finally {
    await api.destroy();
  }
}

function normalizeField(value: string): Hex {
  return toHex32(BigInt(value.startsWith('0x') ? value : `0x${value}`));
}

function hexToBytes(hex: string): Uint8Array {
  const clean = hex.replace(/^0x/, '');
  const out = new Uint8Array(clean.length / 2);
  for (let i = 0; i < out.length; i++) out[i] = parseInt(clean.slice(i * 2, i * 2 + 2), 16);
  return out;
}
