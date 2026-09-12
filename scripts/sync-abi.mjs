#!/usr/bin/env node
// ---------------------------------------------------------------------------
//  Extrae los ABI de `contracts/out` y los deja como TypeScript tipado
// ---------------------------------------------------------------------------
//  Se genera en vez de escribirse a mano por una razón concreta: un ABI copiado
//  a mano se desincroniza en cuanto alguien toca una firma, y el síntoma es una
//  transacción que revierte sin decir por qué. Acá la única fuente de verdad es
//  el artefacto que produjo el compilador.
//
//  El `as const` no es decorativo: es lo que le permite a viem inferir los tipos
//  de cada función y argumento. Sin él, todo es `any` y el error aparece en
//  runtime, en cadena, con gas gastado.
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const targets = [
  ['ProjectVault.sol/ProjectVault.json', 'projectVaultAbi'],
  ['EligibilityRegistry.sol/EligibilityRegistry.json', 'eligibilityRegistryAbi'],
  ['MockUSDT.sol/MockUSDT.json', 'mockUsdtAbi'],
];

let out = `// GENERADO POR scripts/sync-abi.mjs — NO EDITAR A MANO.
// Regenerar con:  node scripts/sync-abi.mjs   (después de \`forge build\`)

`;

for (const [artifact, name] of targets) {
  const path = join(root, 'contracts/out', artifact);
  const { abi } = JSON.parse(readFileSync(path, 'utf8'));
  out += `export const ${name} = ${JSON.stringify(abi, null, 2)} as const;\n\n`;
}

const dest = join(root, 'packages/shared/src/abi.generated.ts');
mkdirSync(dirname(dest), { recursive: true });
writeFileSync(dest, out);
console.log(`ABI sincronizados -> packages/shared/src/abi.generated.ts (${targets.length} contratos)`);
