// ---------------------------------------------------------------------------
//  Datos semilla de la demo  (backlog T15)
// ---------------------------------------------------------------------------
//
//  Levanta un proyecto completo y lo lleva por todo el ciclo de curaduría hasta
//  dejarlo en FUNDING, listo para que un inversionista entre.
//
//  El dossier es deliberadamente REALISTA —fuentes y usos que cuadran, un
//  gravamen de primer rango declarado, hitos con la evidencia pactada de
//  antemano— porque un proyecto de juguete oculta justo las fricciones que el
//  sistema existe para manejar.

import type { ProjectDossier } from '@s2d/shared';
import { parseAmount, validateDossier } from '@s2d/shared';
import { initPoseidon } from '@s2d/zk';
import type { Address } from 'viem';
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { db, resetDb } from './db.ts';
import { REPO_ROOT } from './config.ts';
import { DEMO } from './demo-accounts.ts';
import { createProject, transition, getProject, addReviewNote, addEvidence, setPlatformFields } from './store/projects.ts';
import { upsertInvestor, issueCredential, issuerRoot, setKycStatus } from './store/investors.ts';
import { deployment, operatorClient, publicClient, projectVaultAbi, eligibilityRegistryAbi, mockUsdtAbi } from './chain.ts';
import { sync } from './store/indexer.ts';

const DIA = 24 * 60 * 60 * 1000;
const ahora = Date.now();
const iso = (offsetDias: number) => new Date(ahora + offsetDias * DIA).toISOString();

const ROLE_ID = { LEGAL: 1, SUPERVISOR: 2 } as const;

function dossierAurora(): Omit<ProjectDossier, 'id' | 'onChainId' | 'createdAt' | 'updatedAt' | 'publishedAt' | 'status'> {
  return {
    name: 'Edificio Aurora',
    city: 'Cochabamba',
    type: 'RESIDENCIAL',
    summary:
      'Edificio residencial de 8 plantas y 32 departamentos en la zona de Cala Cala. '
      + 'El terreno está pagado y escriturado a nombre del SPV; se busca financiamiento '
      + 'para obra gruesa y acabados, con repago contra la venta de unidades.',

    developer: {
      id: 'dev-vallesur',
      legalName: 'Vallesur Desarrollos S.R.L.',
      taxId: '1028374650018',
      address: DEMO.developer.address,
      completedProjects: 6,
      yearsActive: 11,
    },

    spv: {
      legalName: 'Aurora Cala Cala S.R.L.',
      taxId: '4059281730014',
      commercialRegistry: 'MC-00294817',
      incorporatedAt: iso(-120),
      jurisdiction: 'Bolivia',
      treasuryAddress: DEMO.developer.address,
    },

    property: {
      cadastralId: '3.01.4.02.0087645',
      address: 'Av. América esq. Pando #1240',
      city: 'Cochabamba',
      landArea: 980,
      buildableArea: 4_410,
      titleHolder: 'Aurora Cala Cala S.R.L.',
      appraisedValue: parseAmount('1420000'),
      appraisedAt: iso(-45),
      appraiser: 'Tasaciones Andinas — Reg. CIT 2291',
      // Declarado y visible desde antes de que nadie invierta: este acreedor
      // cobra ANTES que los inversionistas si hay que ejecutar.
      encumbrances: [{
        type: 'HIPOTECA',
        holder: 'Banco Mercantil Santa Cruz S.A.',
        amount: parseAmount('420000'),
        rank: 1,
        registeredAt: iso(-95),
      }],
      certificateVerifiedAt: iso(-12),
    },

    sourcesAndUses: {
      sources: {
        developerEquity: parseAmount('712000'),
        investorFinancing: parseAmount('900000'),
        bankFinancing: parseAmount('420000'),
        presales: parseAmount('310000'),
      },
      uses: {
        land: parseAmount('520000'),
        construction: parseAmount('1310000'),
        permitsAndFees: parseAmount('86000'),
        professionalServices: parseAmount('142000'),
        marketing: parseAmount('64000'),
        contingency: parseAmount('128000'),
        financialCosts: parseAmount('92000'),
      },
    },

    terms: {
      target: parseAmount('900000'),
      minimumTicket: parseAmount('1000'),
      maximumTicket: parseAmount('300000'),
      termMonths: 24,
      interestBps: 1200,          // 12 % anual
      repaymentModel: 'ON_SALE',
      originationBps: 200,        // 2 % sobre cada tramo liberado (tope: 300)
      successBps: 1500,           // 15 % del retorno, nunca del capital (tope: 2000)
      expectedRevenue: parseAmount('3180000'),
      fundingDeadline: iso(21),
    },

    milestones: [
      {
        index: 0, bps: 2000, role: 'LEGAL', deadline: iso(60),
        title: 'Cierre legal y societario',
        description: 'SPV constituido, terreno transferido, gravámenes verificados y contrato de obra suscrito.',
        requiredEvidence: ['CERTIFICADO', 'CONTRATO'],
      },
      {
        index: 1, bps: 2000, role: 'SUPERVISOR', deadline: iso(150),
        title: 'Excavación y fundaciones',
        description: 'Movimiento de tierras terminado y fundaciones vaciadas según cálculo estructural.',
        requiredEvidence: ['INFORME', 'FOTOGRAFIA', 'FACTURA'],
      },
      {
        index: 2, bps: 2500, role: 'SUPERVISOR', deadline: iso(300),
        title: 'Estructura al 50 %',
        description: 'Cuatro plantas de obra gruesa con losas vaciadas y verificación de avance en sitio.',
        requiredEvidence: ['INFORME', 'FOTOGRAFIA'],
      },
      {
        index: 3, bps: 2000, role: 'SUPERVISOR', deadline: iso(450),
        title: 'Obra gruesa terminada',
        description: 'Ocho plantas ejecutadas, cubierta y cerramientos completos.',
        requiredEvidence: ['INFORME', 'FOTOGRAFIA', 'CERTIFICADO'],
      },
      {
        index: 4, bps: 1500, role: 'LEGAL', deadline: iso(600),
        title: 'Acabados y habitabilidad',
        description: 'Acabados finalizados y certificado municipal de habitabilidad emitido.',
        requiredEvidence: ['CERTIFICADO', 'INFORME'],
      },
    ],

    eligibility: {
      minNetWorth: '100000',
      allowedJurisdiction: 68, // Bolivia
      credentialRoot: '0x0',   // se completa con la raíz vigente al publicar
    },

    risk: null,

    verifiers: [
      {
        id: 'ver-legal', address: DEMO.legal.address, name: 'Dra. Carla Peñaranda',
        role: 'LEGAL', license: 'RAP 14-882', organization: 'Peñaranda & Asociados',
      },
      {
        id: 'ver-obra', address: DEMO.supervisor.address, name: 'Ing. Rodrigo Vásquez',
        role: 'SUPERVISOR', license: 'CIB 21-4417', organization: 'Supervisión Andina S.R.L.',
      },
    ],

    agreementHash: null,
    agreementVersion: null,
    vaultAddress: null,
    chainId: null,
  };
}

async function main() {
  const reset = process.argv.includes('--reset');
  db();
  if (reset) {
    console.log('Base limpiada.');
    resetDb();
  }
  await initPoseidon();

  const deployed = deployment();
  const { client, address: operator } = operatorClient();
  const pub = publicClient();

  // ------------------------------------------------------------- 1. dossier
  const project = createProject(dossierAurora());
  console.log(`Proyecto creado: ${project.id} (onChainId ${project.onChainId})`);

  const issues = validateDossier(project);
  for (const i of issues) console.log(`  ${i.severity === 'ERROR' ? '✗' : '!'} ${i.field}: ${i.message}`);

  // --------------------------------------------------- 2. ciclo de curaduría
  transition(project.id, 'SUBMITTED');
  transition(project.id, 'UNDER_REVIEW');
  addReviewNote(project.id, 'comite@seed2deed.bo', 'UNDER_REVIEW',
    'Título y certificado de gravámenes verificados en Derechos Reales. La hipoteca de primer rango del BMSC queda declarada en el dossier: cobra antes que los inversionistas.');

  setPlatformFields(project.id, {
    risk: {
      scores: { legal: 82, financial: 71, developer: 78, market: 66, property: 74, construction: 70, liquidity: 55 },
      total: 73, grade: 'A',
      rationale: 'Terreno pagado y escriturado al SPV, desarrollador con 6 proyectos entregados y preventas por 310k. '
        + 'Descuenta por la hipoteca de primer rango y por la concentración del repago en la venta de unidades.',
      assessedAt: new Date().toISOString(),
      assessedBy: 'comite@seed2deed.bo',
    },
  });

  transition(project.id, 'APPROVED');
  addReviewNote(project.id, 'comite@seed2deed.bo', 'APPROVED',
    'Aprobado con calificación A. Originación 2 %, éxito 15 %, ambas por debajo del tope inmutable del contrato.');
  console.log('Due diligence completada: APPROVED, riesgo A.');

  // ------------------------------- 3. inversionistas, KYC y credenciales ZK
  const perfiles = [
    { cuenta: DEMO.investorA, nombre: 'María Fernanda Aguilar', email: 'mf.aguilar@example.bo', patrimonio: 380_000n },
    { cuenta: DEMO.investorB, nombre: 'Grupo Inversor Tunari S.A.', email: 'tesoreria@tunari.example', patrimonio: 2_400_000n },
    { cuenta: DEMO.investorC, nombre: 'Joaquín Estrada', email: 'j.estrada@example.bo', patrimonio: 145_000n },
    // Por debajo del mínimo de la ronda (100.000). La plataforma le aprueba el
    // tamizaje AML igual —es una persona real y limpia—, pero el circuito no le
    // va a dejar generar una prueba. Son dos filtros distintos, y se nota.
    { cuenta: DEMO.investorD, nombre: 'Lucía Nogales', email: 'l.nogales@example.bo', patrimonio: 60_000n },
  ];

  const credenciales: Record<string, unknown> = {};
  for (const perfil of perfiles) {
    const investor = upsertInvestor({ address: perfil.cuenta.address, displayName: perfil.nombre, email: perfil.email });

    const { secret } = issueCredential({
      investorId: investor.id,
      jurisdiction: 68,
      netWorth: perfil.patrimonio,
      expiresAt: Math.floor((ahora + 365 * DIA) / 1000),
    });
    // El secreto se muestra una vez y no se guarda. En la demo se vuelca acá
    // para que el e2e y el frontend puedan usarlo.
    credenciales[perfil.cuenta.address] = secret;

    // Tamizaje AML del operador, escrito en el vault.
    const hash = await client.writeContract({
      address: deployed.vault as Address, abi: projectVaultAbi, functionName: 'setKyc',
      args: [perfil.cuenta.address as Address, true], chain: null, account: operator,
    });
    await pub.waitForTransactionReceipt({ hash });
    setKycStatus(investor.address, 'APPROVED', new Date().toISOString());

    // Fondos de prueba.
    const mint = await client.writeContract({
      address: deployed.usdt as Address, abi: mockUsdtAbi, functionName: 'mint',
      args: [perfil.cuenta.address as Address, parseUnits('500000')], chain: null, account: operator,
    });
    await pub.waitForTransactionReceipt({ hash: mint });

    console.log(`  Inversionista ${perfil.nombre}: KYC aprobado, credencial emitida, 500.000 USDT`);
  }

  const root = issuerRoot();
  console.log(`Raíz del emisor KYC: ${root}`);

  // ------------------------------------------------ 4. publicación en cadena
  setPlatformFields(project.id, { credentialRoot: root });
  const listo = getProject(project.id)!;

  const milestones = [...listo.milestones].sort((a, b) => a.index - b.index).map((m) => ({
    bps: m.bps, role: ROLE_ID[m.role],
    deadline: BigInt(Math.floor(Date.parse(m.deadline) / 1000)), released: false,
  }));

  const createHash = await client.writeContract({
    address: deployed.vault as Address, abi: projectVaultAbi, functionName: 'createProject',
    args: [
      BigInt(listo.onChainId), listo.developer.address as Address,
      BigInt(listo.terms.target), BigInt(Math.floor(Date.parse(listo.terms.fundingDeadline) / 1000)),
      milestones, listo.terms.originationBps, listo.terms.successBps,
    ],
    chain: null, account: operator,
  });
  await pub.waitForTransactionReceipt({ hash: createHash });

  for (const verifier of listo.verifiers) {
    const hash = await client.writeContract({
      address: deployed.vault as Address, abi: projectVaultAbi, functionName: 'grantVerifier',
      args: [BigInt(listo.onChainId), verifier.address as Address, ROLE_ID[verifier.role]],
      chain: null, account: operator,
    });
    await pub.waitForTransactionReceipt({ hash });
  }

  const policyHash = await client.writeContract({
    address: deployed.eligibility as Address, abi: eligibilityRegistryAbi, functionName: 'setPolicy',
    args: [BigInt(listo.onChainId), root as `0x${string}`, BigInt(listo.eligibility.minNetWorth), BigInt(listo.eligibility.allowedJurisdiction)],
    chain: null, account: operator,
  });
  await pub.waitForTransactionReceipt({ hash: policyHash });

  setPlatformFields(listo.id, { vaultAddress: deployed.vault, chainId: deployed.chainId });
  transition(listo.id, 'PUBLISHED');
  await sync();
  console.log(`Publicado en cadena. Vault ${deployed.vault}, tx ${createHash}`);

  // ----------------------------------------- 5. evidencia del primer hito
  addEvidence({
    projectId: listo.id, milestoneIndex: 0, kind: 'CERTIFICADO',
    filename: 'certificado-gravamenes-3.01.4.02.0087645.pdf', contentType: 'application/pdf',
    sizeBytes: 184_320, sha256: '0x' + '00'.repeat(32), ipfsCid: null,
    uploadedBy: 'dev-vallesur',
    notes: 'Certificado de gravámenes emitido por Derechos Reales Cochabamba.',
    content: Buffer.from('certificado-gravamenes-aurora-demo'),
  });
  addEvidence({
    projectId: listo.id, milestoneIndex: 0, kind: 'CONTRATO',
    filename: 'contrato-obra-aurora.pdf', contentType: 'application/pdf',
    sizeBytes: 421_888, sha256: '0x' + '00'.repeat(32), ipfsCid: null,
    uploadedBy: 'dev-vallesur',
    notes: 'Contrato de construcción a suma alzada con Constructora Tunari S.R.L.',
    content: Buffer.from('contrato-obra-aurora-demo'),
  });
  console.log('Evidencia del hito 0 cargada.');

  // ---------------------------------------------------------------- resumen
  console.log('\n' + '─'.repeat(68));
  console.log('DEMO LISTA');
  console.log('─'.repeat(68));
  console.log(`proyecto        ${listo.id}  (onChainId ${listo.onChainId})`);
  console.log(`vault           ${deployed.vault}`);
  console.log(`registro ZK     ${deployed.eligibility}`);
  console.log(`USDT            ${deployed.usdt}`);
  console.log(`meta            ${listo.terms.target} (6 decimales)`);
  console.log('\ncredenciales ZK emitidas (el servidor NO las guarda):');
  console.log(JSON.stringify(credenciales, null, 2));
  // Los secretos se vuelcan a un archivo para que el e2e y el frontend de la
  // demo puedan usarlos. Está en .gitignore: son credenciales, aunque sean de
  // juguete, y una credencial de juguete commiteada enseña el hábito equivocado.
  const salida = join(REPO_ROOT, 'backend/data/demo-credentials.json');
  writeFileSync(salida, JSON.stringify({ projectId: listo.id, onChainId: listo.onChainId, issuerRoot: root, credentials: credenciales }, null, 2));
  console.log(`\nCredenciales volcadas en ${salida}`);
  console.log('Siguiente paso:  npm run e2e');
}

/** USDT tiene 6 decimales. */
function parseUnits(whole: string): bigint {
  return BigInt(whole) * 1_000_000n;
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
