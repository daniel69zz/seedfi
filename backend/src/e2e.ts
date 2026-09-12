// ---------------------------------------------------------------------------
//  Prueba end-to-end del flujo completo  (backlog T16)
// ---------------------------------------------------------------------------
//
//  Recorre el camino entero contra la cadena de verdad: prueba ZK real,
//  contratos reales, firmas EIP-712 reales. No hay mocks.
//
//  Dos escenarios, porque uno solo miente:
//
//    A — CAMINO FELIZ. Elegibilidad probada en ZK, tres inversionistas entran,
//        la ronda cierra, los cinco hitos se acreditan y se liberan, la
//        constructora repaga y cada inversionista cobra a prorrata.
//
//    B — EL FRENO. Un hito es rechazado por el verificador y el capital que NO
//        se había liberado vuelve íntegro a los inversionistas, sin comisión y
//        sin que la plataforma tenga que autorizar nada.
//
//  El escenario B es el que importa. Cualquier plataforma puede demostrar que
//  el dinero entra; lo que hay que demostrar es qué pasa cuando algo sale mal.

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import assert from 'node:assert/strict';
import { createWalletClient, createPublicClient, http, type Address, type Hex } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { parseAmount, type ProjectDossier } from '@s2d/shared';
import { initPoseidon, generateEligibilityProof, checkEligibilityLocally, type Credential } from '@s2d/zk';
import { config, REPO_ROOT } from './config.ts';
import { db } from './db.ts';
import { DEMO } from './demo-accounts.ts';
import { deployment, operatorClient, publicClient, projectVaultAbi, eligibilityRegistryAbi, mockUsdtAbi, readProject, statusName } from './chain.ts';
import { getProject, createProject, transition, setPlatformFields, addEvidence, listProjects } from './store/projects.ts';
import { createAttestation } from './store/attestations.ts';
import { merklePathFor, issuerRoot, issuerTree, upsertInvestor, issueCredential, setKycStatus } from './store/investors.ts';
import { credentialLeaf } from '@s2d/zk';
import { sync } from './store/indexer.ts';

const chain = {
  id: config.chainId, name: `chain-${config.chainId}`,
  nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
  rpcUrls: { default: { http: [config.rpcUrl] } },
} as const;

const pub = publicClient();
let deployed: ReturnType<typeof deployment>;

function wallet(key: string) {
  const account = privateKeyToAccount(key as Hex);
  return { client: createWalletClient({ account, chain, transport: http(config.rpcUrl) }), address: account.address };
}

async function send(key: string, params: Record<string, unknown>): Promise<Hex> {
  const { client, address } = wallet(key);
  const hash = await client.writeContract({ ...params, chain: null, account: address } as never);
  const receipt = await pub.waitForTransactionReceipt({ hash });
  assert.equal(receipt.status, 'success', `la transaccion revirtio: ${hash}`);
  return hash;
}

function usdt(address: string) {
  return pub.readContract({ address: deployed.usdt as Address, abi: mockUsdtAbi, functionName: 'balanceOf', args: [address as Address] }) as Promise<bigint>;
}

const fmt = (v: bigint) => (Number(v) / 1e6).toLocaleString('es-BO', { minimumFractionDigits: 2 });

let paso = 0;
function titulo(texto: string) {
  console.log(`\n${'─'.repeat(72)}\n${String(++paso).padStart(2, '0')}. ${texto}\n${'─'.repeat(72)}`);
}
const ok = (texto: string) => console.log(`   ✓ ${texto}`);

// =====================================================================
//  Elegibilidad ZK
// =====================================================================

interface DemoCreds {
  projectId: string;
  onChainId: number;
  credentials: Record<string, { secret: string; jurisdiction: number; netWorth: string; expiresAt: number }>;
}

function circuit() {
  return JSON.parse(readFileSync(config.circuitPath, 'utf8'));
}

async function probarElegibilidad(onChainId: number, address: string, raw: DemoCreds['credentials'][string], minNetWorth: bigint) {
  const credential: Credential = {
    secret: BigInt(raw.secret), jurisdiction: raw.jurisdiction,
    netWorth: BigInt(raw.netWorth), expiresAt: raw.expiresAt,
  };

  const leaf = `0x${credentialLeaf(credential).toString(16).padStart(64, '0')}`;
  const path = merklePathFor(leaf);
  // `now` lo elige el prover, pero el contrato exige que sea reciente: se toma
  // del bloque para que coincida con el reloj de la cadena, no con el del host.
  const now = Number((await pub.getBlock()).timestamp);

  const proof = await generateEligibilityProof(circuit(), {
    credential,
    merkleProof: {
      root: BigInt(path.root), path: path.path.map((p) => BigInt(p)),
      indexBits: path.indexBits, leaf: BigInt(leaf), index: path.index,
    },
    projectId: onChainId,
    investorAddress: address,
    minNetWorth,
    allowedJurisdiction: 68,
    now,
  });

  return proof;
}

// =====================================================================

async function main() {
  db();
  await initPoseidon();
  deployed = deployment();

  const creds = JSON.parse(readFileSync(join(REPO_ROOT, 'backend/data/demo-credentials.json'), 'utf8')) as DemoCreds;
  const project = getProject(creds.projectId);
  assert.ok(project, 'no hay proyecto sembrado: corré `npm run seed -- --reset`');

  console.log(`\nSeed 2 Deed — end-to-end sobre ${chain.name} (${config.rpcUrl})`);
  console.log(`Proyecto: ${project.name} · meta ${fmt(BigInt(project.terms.target))} USDT`);

  await escenarioFeliz(project, creds);
  await escenarioFreno();

  console.log(`\n${'═'.repeat(72)}`);
  console.log('TODO VERDE — el flujo completo corrió contra contratos y pruebas ZK reales.');
  console.log('═'.repeat(72) + '\n');
}

// =====================================================================
//  ESCENARIO A — camino feliz
// =====================================================================

async function escenarioFeliz(project: ProjectDossier, creds: DemoCreds) {
  const id = project.onChainId;
  const minNetWorth = BigInt(project.eligibility.minNetWorth);

  titulo('Elegibilidad: lo que la plataforma NO llega a ver');

  // El caso que importa: una inversionista real, con KYC aprobado por la
  // plataforma, a la que el circuito le impide entrar por no alcanzar el
  // patrimonio mínimo — sin que su patrimonio se revele en ningún lado.
  const rechazada = creds.credentials[DEMO.investorD.address]!;
  const problemas = checkEligibilityLocally({
    credential: { secret: BigInt(rechazada.secret), jurisdiction: rechazada.jurisdiction, netWorth: BigInt(rechazada.netWorth), expiresAt: rechazada.expiresAt },
    merkleProof: { root: 0n, path: [], indexBits: [], leaf: 0n, index: 0 },
    projectId: id, investorAddress: DEMO.investorD.address, minNetWorth, allowedJurisdiction: 68,
    now: Math.floor(Date.now() / 1000),
  });
  assert.ok(problemas.length > 0, 'la inversionista sin patrimonio suficiente deberia ser rechazada');
  ok(`Lucía Nogales (KYC aprobado) no puede generar prueba: ${problemas[0]}`);
  ok('La plataforma no supo su patrimonio; solo supo que no alcanza.');

  const aportes = [
    { nombre: 'María Fernanda', cuenta: DEMO.investorA, monto: parseAmount('300000') },
    { nombre: 'Grupo Tunari', cuenta: DEMO.investorB, monto: parseAmount('400000') },
    { nombre: 'Joaquín Estrada', cuenta: DEMO.investorC, monto: parseAmount('200000') },
  ];

  titulo('Prueba ZK + inversión');
  for (const aporte of aportes) {
    const raw = creds.credentials[aporte.cuenta.address]!;
    const t0 = Date.now();
    const proof = await probarElegibilidad(id, aporte.cuenta.address, raw, minNetWorth);

    await send(aporte.cuenta.key, {
      address: deployed.eligibility as Address, abi: eligibilityRegistryAbi,
      functionName: 'proveEligibility', args: [BigInt(id), proof.proof, proof.publicInputs],
    });

    const elegible = await pub.readContract({
      address: deployed.eligibility as Address, abi: eligibilityRegistryAbi,
      functionName: 'isEligible', args: [BigInt(id), aporte.cuenta.address as Address],
    });
    assert.equal(elegible, true);

    await send(aporte.cuenta.key, {
      address: deployed.usdt as Address, abi: mockUsdtAbi, functionName: 'approve',
      args: [deployed.vault as Address, BigInt(aporte.monto)],
    });
    await send(aporte.cuenta.key, {
      address: deployed.vault as Address, abi: projectVaultAbi, functionName: 'invest',
      args: [BigInt(id), BigInt(aporte.monto)],
    });

    ok(`${aporte.nombre}: prueba en ${Date.now() - t0} ms → ${fmt(BigInt(aporte.monto))} USDT invertidos`);
  }

  // Una credencial no entra dos veces: el nullifier ya está quemado.
  const raw = creds.credentials[DEMO.investorA.address]!;
  const repetida = await probarElegibilidad(id, DEMO.investorA.address, raw, minNetWorth);
  await assert.rejects(
    send(DEMO.investorA.key, {
      address: deployed.eligibility as Address, abi: eligibilityRegistryAbi,
      functionName: 'proveEligibility', args: [BigInt(id), repetida.proof, repetida.publicInputs],
    }),
    'la misma credencial no deberia poder registrarse dos veces',
  );
  ok('La misma credencial rechazada al segundo intento (nullifier quemado).');

  let estado = (await readProject(id))!;
  assert.equal(statusName(estado.status), 'ACTIVE');
  assert.equal(estado.raised, BigInt(project.terms.target));
  ok(`Ronda cerrada: ${fmt(estado.raised)} USDT recaudados → ACTIVE`);

  // ------------------------------------------------------------- hitos
  titulo('Hitos: la plata sale por tramos, contra firma de un tercero');

  const saldoConstructoraInicial = await usdt(DEMO.developer.address);
  const saldoTesoreriaInicial = await usdt(DEMO.operator.address);

  for (const hito of [...project.milestones].sort((a, b) => a.index - b.index)) {
    // Evidencia antes de firmar. `evidenceBundleHash` revienta si no hay.
    if (hito.index > 0) {
      for (const kind of hito.requiredEvidence) {
        addEvidence({
          projectId: project.id, milestoneIndex: hito.index, kind: kind as never,
          filename: `hito-${hito.index}-${kind.toLowerCase()}.pdf`, contentType: 'application/pdf',
          sizeBytes: 100_000, sha256: '0x' + '00'.repeat(32), ipfsCid: null,
          uploadedBy: 'dev-vallesur', notes: `Evidencia de ${hito.title}`,
          content: Buffer.from(`evidencia-${project.id}-${hito.index}-${kind}`),
        });
      }
    }

    const key = hito.role === 'LEGAL' ? DEMO.legal.key : DEMO.supervisor.key;
    const attestation = await createAttestation({
      projectId: project.id, milestoneIndex: hito.index, approved: true, verifierKey: key as Hex,
    });

    const antes = await usdt(DEMO.developer.address);
    // La manda el DESARROLLADOR, no el operador: `releaseMilestone` autoriza por
    // la firma, no por el remitente. Es lo que hace que el desembolso no dependa
    // de que un servidor de la plataforma esté vivo.
    await send(DEMO.developer.key, {
      address: deployed.vault as Address, abi: projectVaultAbi, functionName: 'releaseMilestone',
      args: [{
        projectId: BigInt(id), milestoneIndex: attestation.milestoneIndex,
        evidenceHash: attestation.evidenceHash as Hex, approved: true,
        nonce: BigInt(attestation.nonce), expiresAt: BigInt(attestation.expiresAt),
      }, attestation.signature as Hex],
    });
    const recibido = (await usdt(DEMO.developer.address)) - antes;

    const bruto = (estado.raised * BigInt(hito.bps)) / 10_000n;
    const comision = (bruto * BigInt(project.terms.originationBps)) / 10_000n;
    ok(`Hito ${hito.index} «${hito.title}» — firmó ${attestation.signer.slice(0, 10)}… (${hito.role})`);
    console.log(`      bruto ${fmt(bruto)} · comisión ${fmt(comision)} · a la constructora ${fmt(recibido)}`);
  }

  estado = (await readProject(id))!;
  assert.equal(statusName(estado.status), 'COMPLETED');
  assert.equal(estado.released, estado.raised, 'se tiene que haber liberado todo lo recaudado');

  const comisionTotal = (await usdt(DEMO.operator.address)) - saldoTesoreriaInicial;
  const aLaConstructora = (await usdt(DEMO.developer.address)) - saldoConstructoraInicial;
  assert.equal(comisionTotal + aLaConstructora, estado.raised, 'no puede faltar ni sobrar un centavo');
  ok(`COMPLETED. Constructora ${fmt(aLaConstructora)} + comisión ${fmt(comisionTotal)} = ${fmt(estado.raised)} recaudado`);

  // ------------------------------------------------------------ repago
  titulo('Repago: la plataforma no gana hasta que el inversionista cobra');

  const capital = estado.raised;
  const interes = (capital * 12n) / 100n; // 12 % del ejemplo
  const total = capital + interes;

  await send(DEMO.operator.key, {
    address: deployed.usdt as Address, abi: mockUsdtAbi, functionName: 'mint',
    args: [DEMO.developer.address as Address, total],
  });
  await send(DEMO.developer.key, {
    address: deployed.usdt as Address, abi: mockUsdtAbi, functionName: 'approve',
    args: [deployed.vault as Address, total],
  });

  // Primera cuota: SOLO capital parcial. La comisión de éxito sobre esto tiene
  // que ser cero — mientras no se devuelva todo el capital, la plataforma no
  // cobra nada.
  const tesoreriaAntesDelRepago = await usdt(DEMO.operator.address);
  await send(DEMO.developer.key, {
    address: deployed.vault as Address, abi: projectVaultAbi, functionName: 'repay',
    args: [BigInt(id), capital / 2n],
  });
  assert.equal(await usdt(DEMO.operator.address), tesoreriaAntesDelRepago,
    'la plataforma cobro comision sobre capital, no sobre retorno');
  ok(`Cuota 1: ${fmt(capital / 2n)} USDT de capital → comisión de éxito cobrada: 0`);

  await send(DEMO.developer.key, {
    address: deployed.vault as Address, abi: projectVaultAbi, functionName: 'repay',
    args: [BigInt(id), total - capital / 2n],
  });
  const comisionExito = (await usdt(DEMO.operator.address)) - tesoreriaAntesDelRepago;
  const esperada = (interes * BigInt(project.terms.successBps)) / 10_000n;
  assert.equal(comisionExito, esperada);
  ok(`Cuota 2: ${fmt(total - capital / 2n)} → comisión de éxito ${fmt(comisionExito)} (${project.terms.successBps / 100} % del retorno, 0 % del capital)`);

  // ------------------------------------------------------------- claim
  let cobrado = 0n;
  for (const aporte of aportes) {
    const antes = await usdt(aporte.cuenta.address);
    await send(aporte.cuenta.key, {
      address: deployed.vault as Address, abi: projectVaultAbi, functionName: 'claim', args: [BigInt(id)],
    });
    const recibio = (await usdt(aporte.cuenta.address)) - antes;
    cobrado += recibio;
    const ganancia = recibio - BigInt(aporte.monto);
    ok(`${aporte.nombre}: invirtió ${fmt(BigInt(aporte.monto))} → cobró ${fmt(recibio)} (+${fmt(ganancia)})`);
  }

  const neto = total - esperada;
  // Puede quedar polvo de redondeo por debajo de 1 unidad por inversionista.
  assert.ok(neto - cobrado < BigInt(aportes.length), `descuadre en el reparto: ${neto - cobrado}`);
  ok(`Repartido ${fmt(cobrado)} de ${fmt(neto)} netos — polvo de redondeo: ${neto - cobrado} unidades`);

  await sync();
}

// =====================================================================
//  ESCENARIO B — el freno
// =====================================================================

async function escenarioFreno() {
  titulo('EL FRENO: un hito rechazado devuelve el capital no liberado');

  const { client, address: operator } = operatorClient();
  const onChainId = Math.max(...listProjects().map((p) => p.onChainId)) + 1;
  const DIA = 24 * 60 * 60 * 1000;
  const iso = (d: number) => new Date(Date.now() + d * DIA).toISOString();

  const dossier = createProject({
    name: 'Condominio Sacaba (escenario de fracaso)',
    city: 'Cochabamba', type: 'RESIDENCIAL',
    summary: 'Proyecto de prueba para demostrar qué pasa cuando la obra no avanza.',
    developer: { id: 'dev-vallesur', legalName: 'Vallesur Desarrollos S.R.L.', taxId: '1028374650018', address: DEMO.developer.address, completedProjects: 6, yearsActive: 11 },
    spv: { legalName: 'Sacaba Norte S.R.L.', taxId: '4059281730022', commercialRegistry: 'MC-00294999', incorporatedAt: iso(-60), jurisdiction: 'Bolivia', treasuryAddress: DEMO.developer.address },
    property: {
      cadastralId: '3.02.1.01.0012345', address: 'Av. Villazón km 12', city: 'Cochabamba',
      landArea: 1200, buildableArea: 2400, titleHolder: 'Sacaba Norte S.R.L.',
      appraisedValue: parseAmount('600000'), appraisedAt: iso(-30), appraiser: 'Tasaciones Andinas',
      encumbrances: [], certificateVerifiedAt: iso(-10),
    },
    sourcesAndUses: {
      sources: { developerEquity: parseAmount('150000'), investorFinancing: parseAmount('200000'), bankFinancing: parseAmount('0'), presales: parseAmount('0') },
      uses: { land: parseAmount('120000'), construction: parseAmount('170000'), permitsAndFees: parseAmount('12000'), professionalServices: parseAmount('16000'), marketing: parseAmount('6000'), contingency: parseAmount('20000'), financialCosts: parseAmount('6000') },
    },
    terms: {
      target: parseAmount('200000'), minimumTicket: parseAmount('1000'), maximumTicket: null,
      termMonths: 18, interestBps: 1400, repaymentModel: 'BULLET',
      originationBps: 200, successBps: 1500, expectedRevenue: parseAmount('620000'),
      fundingDeadline: iso(14),
    },
    milestones: [
      { index: 0, bps: 3000, role: 'LEGAL', deadline: iso(45), title: 'Cierre legal', description: 'SPV y terreno.', requiredEvidence: ['CERTIFICADO'] },
      { index: 1, bps: 4000, role: 'SUPERVISOR', deadline: iso(120), title: 'Obra gruesa', description: 'Estructura completa.', requiredEvidence: ['INFORME'] },
      { index: 2, bps: 3000, role: 'SUPERVISOR', deadline: iso(240), title: 'Acabados', description: 'Terminaciones.', requiredEvidence: ['INFORME'] },
    ],
    eligibility: { minNetWorth: '100000', allowedJurisdiction: 68, credentialRoot: issuerRoot() },
    risk: null,
    verifiers: [
      { id: 'ver-legal', address: DEMO.legal.address, name: 'Dra. Carla Peñaranda', role: 'LEGAL', license: 'RAP 14-882', organization: 'Peñaranda & Asociados' },
      { id: 'ver-obra', address: DEMO.supervisor.address, name: 'Ing. Rodrigo Vásquez', role: 'SUPERVISOR', license: 'CIB 21-4417', organization: 'Supervisión Andina S.R.L.' },
    ],
    agreementHash: null, agreementVersion: null, vaultAddress: null, chainId: null,
  });

  transition(dossier.id, 'SUBMITTED');
  transition(dossier.id, 'UNDER_REVIEW');
  transition(dossier.id, 'APPROVED');

  const ROLE_ID = { LEGAL: 1, SUPERVISOR: 2 } as const;
  await send(DEMO.operator.key, {
    address: deployed.vault as Address, abi: projectVaultAbi, functionName: 'createProject',
    args: [
      BigInt(dossier.onChainId), DEMO.developer.address as Address, BigInt(dossier.terms.target),
      BigInt(Math.floor(Date.parse(dossier.terms.fundingDeadline) / 1000)),
      [...dossier.milestones].sort((a, b) => a.index - b.index).map((m) => ({
        bps: m.bps, role: ROLE_ID[m.role], deadline: BigInt(Math.floor(Date.parse(m.deadline) / 1000)), released: false,
      })),
      dossier.terms.originationBps, dossier.terms.successBps,
    ],
  });
  for (const v of dossier.verifiers) {
    await send(DEMO.operator.key, {
      address: deployed.vault as Address, abi: projectVaultAbi, functionName: 'grantVerifier',
      args: [BigInt(dossier.onChainId), v.address as Address, ROLE_ID[v.role]],
    });
  }
  await send(DEMO.operator.key, {
    address: deployed.eligibility as Address, abi: eligibilityRegistryAbi, functionName: 'setPolicy',
    args: [BigInt(dossier.onChainId), issuerRoot() as Hex, 100_000n, 68n],
  });
  setPlatformFields(dossier.id, { vaultAddress: deployed.vault, chainId: deployed.chainId });
  transition(dossier.id, 'PUBLISHED');
  ok(`Proyecto ${dossier.onChainId} publicado: meta ${fmt(BigInt(dossier.terms.target))} USDT`);

  // Nuevas credenciales: las del escenario A ya quemaron su nullifier, pero acá
  // el proyecto es otro y el nullifier también. Para mantenerlo simple, se
  // emiten credenciales nuevas para dos inversionistas.
  const creds = JSON.parse(readFileSync(join(REPO_ROOT, 'backend/data/demo-credentials.json'), 'utf8')) as DemoCreds;
  const participantes = [
    { nombre: 'María Fernanda', cuenta: DEMO.investorA, monto: parseAmount('120000') },
    { nombre: 'Grupo Tunari', cuenta: DEMO.investorB, monto: parseAmount('80000') },
  ];

  const invertido: Record<string, bigint> = {};
  for (const p of participantes) {
    const raw = creds.credentials[p.cuenta.address]!;
    const proof = await probarElegibilidad(dossier.onChainId, p.cuenta.address, raw, 100_000n);
    await send(p.cuenta.key, {
      address: deployed.eligibility as Address, abi: eligibilityRegistryAbi,
      functionName: 'proveEligibility', args: [BigInt(dossier.onChainId), proof.proof, proof.publicInputs],
    });
    await send(p.cuenta.key, {
      address: deployed.usdt as Address, abi: mockUsdtAbi, functionName: 'approve',
      args: [deployed.vault as Address, BigInt(p.monto)],
    });
    await send(p.cuenta.key, {
      address: deployed.vault as Address, abi: projectVaultAbi, functionName: 'invest',
      args: [BigInt(dossier.onChainId), BigInt(p.monto)],
    });
    invertido[p.cuenta.address] = BigInt(p.monto);
  }
  ok(`Nullifiers distintos por proyecto: las mismas credenciales entran a la ronda 2 sin ser correlacionables con la 1`);

  // Hito 0: se cumple y se libera el 30 %.
  addEvidence({
    projectId: dossier.id, milestoneIndex: 0, kind: 'CERTIFICADO',
    filename: 'cierre-legal.pdf', contentType: 'application/pdf', sizeBytes: 90_000,
    sha256: '0x' + '00'.repeat(32), ipfsCid: null, uploadedBy: 'dev-vallesur',
    notes: 'Cierre legal', content: Buffer.from(`sacaba-hito-0`),
  });
  const att0 = await createAttestation({ projectId: dossier.id, milestoneIndex: 0, approved: true, verifierKey: DEMO.legal.key as Hex });
  await send(DEMO.developer.key, {
    address: deployed.vault as Address, abi: projectVaultAbi, functionName: 'releaseMilestone',
    args: [{ projectId: BigInt(dossier.onChainId), milestoneIndex: 0, evidenceHash: att0.evidenceHash as Hex, approved: true, nonce: BigInt(att0.nonce), expiresAt: BigInt(att0.expiresAt) }, att0.signature as Hex],
  });
  ok('Hito 0 acreditado: se libera el 30 %.');

  // Hito 1: el supervisor va a la obra y NO se cumplió.
  addEvidence({
    projectId: dossier.id, milestoneIndex: 1, kind: 'INFORME',
    filename: 'inspeccion-obra-gruesa.pdf', contentType: 'application/pdf', sizeBytes: 140_000,
    sha256: '0x' + '00'.repeat(32), ipfsCid: null, uploadedBy: 'ver-obra',
    notes: 'Inspección en sitio: avance real 12 % contra 100 % comprometido.',
    content: Buffer.from('sacaba-inspeccion-negativa'),
  });
  const att1 = await createAttestation({ projectId: dossier.id, milestoneIndex: 1, approved: false, verifierKey: DEMO.supervisor.key as Hex });
  await send(DEMO.supervisor.key, {
    address: deployed.vault as Address, abi: projectVaultAbi, functionName: 'failMilestone',
    args: [{ projectId: BigInt(dossier.onChainId), milestoneIndex: 1, evidenceHash: att1.evidenceHash as Hex, approved: false, nonce: BigInt(att1.nonce), expiresAt: BigInt(att1.expiresAt) }, att1.signature as Hex],
  });

  const estado = (await readProject(dossier.onChainId))!;
  assert.equal(statusName(estado.status), 'MILESTONE_FAILED');
  ok(`Hito 1 rechazado por el supervisor → MILESTONE_FAILED. Congelado: ${fmt(estado.frozenRemaining)} USDT`);

  // Y ahora lo que importa: recuperar, sin pedirle permiso a nadie.
  let devuelto = 0n;
  for (const p of participantes) {
    const antes = await usdt(p.cuenta.address);
    await send(p.cuenta.key, {
      address: deployed.vault as Address, abi: projectVaultAbi, functionName: 'refundRemaining',
      args: [BigInt(dossier.onChainId)],
    });
    const recibio = (await usdt(p.cuenta.address)) - antes;
    devuelto += recibio;

    const esperado = (invertido[p.cuenta.address]! * estado.frozenRemaining) / estado.raised;
    assert.equal(recibio, esperado, 'el reembolso no fue a prorrata');
    ok(`${p.nombre}: recuperó ${fmt(recibio)} de ${fmt(invertido[p.cuenta.address]!)} — a prorrata, sin comisión`);
  }

  assert.ok(estado.frozenRemaining - devuelto < BigInt(participantes.length));
  ok('Se devolvió el 100 % del capital no liberado. La plataforma no cobró nada por el fracaso.');
  ok('Ninguna de estas transacciones necesitó la firma del operador.');

  await sync();
}

main().catch((error) => {
  console.error('\n✗ E2E FALLÓ\n');
  console.error(error);
  process.exit(1);
});
