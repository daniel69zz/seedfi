// ---------------------------------------------------------------------------
//  API de proyectos  (backlog T6)
// ---------------------------------------------------------------------------
import type { FastifyInstance } from 'fastify';
import type { Address, Hex } from 'viem';
import { validateDossier, computeRiskTotal, riskGradeFor, type ProjectDossier, type RiskDimension } from '@s2d/shared';
import {
  listProjects, getProject, createProject, updateProject, setPlatformFields, transition, markPublished,
  addReviewNote, reviewNotes, listEvidence, addEvidence, evidenceBundleHash, DomainError,
} from '../store/projects.ts';
import { pinAndUpdate, isConfigured as ipfsConfigured, gatewayUrl } from '../store/ipfs.ts';
import { eventsFor, sync } from '../store/indexer.ts';
import {
  CONFIRMATIONS, deployment, operatorClient, publicClient, readProject, readMilestones,
  projectVaultAbi, eligibilityRegistryAbi, statusName,
} from '../chain.ts';
import { issuerRoot } from '../store/investors.ts';

const ROLE_ID = { LEGAL: 1, SUPERVISOR: 2 } as const;

export async function projectRoutes(app: FastifyInstance): Promise<void> {
  // ------------------------------------------------------------- marketplace

  app.get('/api/projects', async (request) => {
    const { status, developerId } = request.query as { status?: string; developerId?: string };
    const projects = listProjects({
      status: status ? (status.split(',') as never) : undefined,
      developerId,
    });
    return { projects };
  });

  /** Lo que ve el inversionista: solo lo que ya pasó due diligence. */
  app.get('/api/marketplace', async () => {
    const projects = listProjects({ status: ['PUBLISHED', 'FUNDING', 'ACTIVE', 'COMPLETED'] as never });
    return { projects };
  });

  app.get('/api/projects/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    const project = getProject(id);
    if (!project) return reply.code(404).send({ error: 'Proyecto inexistente' });

    return {
      project,
      validation: validateDossier(project),
      evidence: listEvidence(project.id),
      reviewNotes: reviewNotes(project.id),
      events: eventsFor(project.onChainId),
    };
  });

  // ------------------------------------------------------------- dossier

  app.post('/api/projects', async (request, reply) => {
    const body = request.body as Omit<ProjectDossier, 'id' | 'onChainId' | 'createdAt' | 'updatedAt' | 'publishedAt' | 'status'>;
    const project = createProject(body);
    // Se valida y se devuelve el resultado en vez de rechazar: un borrador
    // incompleto tiene que poder guardarse. La barrera está al presentarlo.
    return reply.code(201).send({ project, validation: validateDossier(project) });
  });

  app.patch('/api/projects/:id', async (request) => {
    const { id } = request.params as { id: string };
    const project = updateProject(id, request.body as Partial<ProjectDossier>);
    return { project, validation: validateDossier(project) };
  });

  app.post('/api/projects/:id/risk', async (request) => {
    const { id } = request.params as { id: string };
    const body = request.body as { scores: Record<RiskDimension, number>; rationale: string; assessedBy: string };
    const total = computeRiskTotal(body.scores);
    // La calificación la produce el comité, no el desarrollador: va por
    // `setPlatformFields`, que escribe aunque el dossier ya esté congelado.
    const project = setPlatformFields(id, {
      risk: {
        scores: body.scores, total, grade: riskGradeFor(total),
        rationale: body.rationale, assessedAt: new Date().toISOString(), assessedBy: body.assessedBy,
      },
    });
    return { project };
  });

  // -------------------------------------------------------- ciclo de revisión

  app.post('/api/projects/:id/submit', async (request) => {
    const { id } = request.params as { id: string };
    return { project: transition(id, 'SUBMITTED') };
  });

  app.post('/api/projects/:id/review', async (request, reply) => {
    const { id } = request.params as { id: string };
    const { decision, note, author } = request.body as {
      decision: 'UNDER_REVIEW' | 'CHANGES_REQUESTED' | 'APPROVED' | 'REJECTED';
      note: string; author: string;
    };
    if (!note?.trim()) {
      return reply.code(400).send({
        error: 'Toda decisión de due diligence lleva una nota. Un “rechazado” sin motivo no le sirve a nadie: ni al desarrollador para corregir, ni al comité para revisarlo después.',
      });
    }
    const project = transition(id, decision);
    addReviewNote(project.id, author, decision, note);
    return { project, reviewNotes: reviewNotes(project.id) };
  });

  // ------------------------------------------------------------- publicación

  /**
   * Crea el proyecto EN CADENA y lo publica.
   *
   * Es el punto sin retorno: a partir de acá los hitos, la meta, el plazo y las
   * comisiones quedan grabados en el vault y no se pueden cambiar. Por eso solo
   * se puede llegar desde APPROVED, y por eso se revalida el dossier entero
   * aunque ya se haya validado al presentarlo.
   */
  app.post('/api/projects/:id/publish', async (request, reply) => {
    const { id } = request.params as { id: string };
    const project = getProject(id);
    if (!project) return reply.code(404).send({ error: 'Proyecto inexistente' });
    if (project.status !== 'APPROVED') {
      return reply.code(409).send({ error: `Solo se publica un proyecto APPROVED; este está en ${project.status}.` });
    }

    const blocking = validateDossier(project).filter((i) => i.severity === 'ERROR');
    if (blocking.length > 0) {
      return reply.code(422).send({ error: 'El dossier dejó de ser válido desde la aprobación.', details: blocking });
    }

    const { client } = operatorClient();
    const deployed = deployment();
    const pub = publicClient();

    const milestones = [...project.milestones].sort((a, b) => a.index - b.index).map((m) => ({
      bps: m.bps,
      role: ROLE_ID[m.role],
      deadline: BigInt(Math.floor(Date.parse(m.deadline) / 1000)),
      released: false,
    }));

    const createHash = await client.writeContract({
      address: deployed.vault as Address, abi: projectVaultAbi, functionName: 'createProject',
      args: [
        BigInt(project.onChainId), project.developer.address as Address,
        BigInt(project.terms.target), BigInt(Math.floor(Date.parse(project.terms.fundingDeadline) / 1000)),
        milestones, project.terms.originationBps, project.terms.successBps,
      ],
      chain: null, account: client.account!,
    });
    await pub.waitForTransactionReceipt({ hash: createHash, confirmations: CONFIRMATIONS });

    // Los verificadores se registran DESPUÉS de crear el proyecto: el contrato
    // exige que exista, y además prohíbe que el operador se designe a sí mismo.
    const verifierTxs: string[] = [];
    for (const verifier of project.verifiers) {
      const hash = await client.writeContract({
        address: deployed.vault as Address, abi: projectVaultAbi, functionName: 'grantVerifier',
        args: [BigInt(project.onChainId), verifier.address as Address, ROLE_ID[verifier.role]],
        chain: null, account: client.account!,
      });
      await pub.waitForTransactionReceipt({ hash, confirmations: CONFIRMATIONS });
      verifierTxs.push(hash);
    }

    // Política de elegibilidad ZK de la ronda.
    //
    // La raíz se normaliza en vez de confiar en un `||`: los dossiers nuevos
    // traen `'0x0'` como marcador de «todavía sin raíz», y `'0x0'` es TRUTHY.
    // Un `||` lo dejaba pasar tal cual a un parámetro `bytes32`, y la
    // publicación moría con «Size of bytes "0x0" (bytes1) does not match
    // expected size (bytes32)» — un error que no dice nada sobre la causa.
    //
    // La ronda tiene que abrir contra la raíz VIGENTE del emisor de todos
    // modos: una raíz vieja rechazaría cualquier prueba con `RaizNoCoincide`.
    const declaredRoot = project.eligibility.credentialRoot ?? '';
    const credentialRoot = (/^0x[0-9a-fA-F]{64}$/.test(declaredRoot) ? declaredRoot : issuerRoot()) as Hex;

    const policyHash = await client.writeContract({
      address: deployed.eligibility as Address, abi: eligibilityRegistryAbi, functionName: 'setPolicy',
      args: [
        BigInt(project.onChainId),
        credentialRoot,
        BigInt(project.eligibility.minNetWorth),
        BigInt(project.eligibility.allowedJurisdiction),
      ],
      chain: null, account: client.account!,
    });
    await pub.waitForTransactionReceipt({ hash: policyHash, confirmations: CONFIRMATIONS });

    // Queda registrado contra qué raíz abrió la ronda: si el emisor la cambia
    // después, se puede explicar por qué una prueba dejó de validar.
    setPlatformFields(project.id, { credentialRoot });
    const published = updateProjectChainRefs(project, deployed.vault, deployed.chainId);
    const result = markPublished(published.id);
    await sync();

    return { project: getProject(result.id), transactions: { createProject: createHash, grantVerifiers: verifierTxs, setPolicy: policyHash } };
  });

  // ------------------------------------------------------------ estado real

  /** Lo que dice la cadena, no lo que dice la base de datos. */
  app.get('/api/projects/:id/chain', async (request, reply) => {
    const { id } = request.params as { id: string };
    const project = getProject(id);
    if (!project) return reply.code(404).send({ error: 'Proyecto inexistente' });

    const onChain = await readProject(project.onChainId);
    if (!onChain) return reply.code(409).send({ error: 'El proyecto todavía no existe en cadena. Publicalo primero.' });

    const milestones = await readMilestones(project.onChainId);
    const deployed = deployment();

    return {
      vault: deployed.vault,
      chainId: deployed.chainId,
      status: statusName(onChain.status),
      target: onChain.target.toString(),
      raised: onChain.raised.toString(),
      released: onChain.released.toString(),
      // Lo que sigue en el vault y todavía no se liberó. Es el número que le
      // importa al inversionista: es lo que puede recuperar si un hito falla.
      locked: (onChain.raised - onChain.released).toString(),
      frozenRemaining: onChain.frozenRemaining.toString(),
      totalRepaid: onChain.totalRepaid.toString(),
      nextMilestone: onChain.nextMilestone,
      originationBps: onChain.originationBps,
      successBps: onChain.successBps,
      milestones: milestones.map((m, i) => ({
        index: i, bps: m.bps, role: m.role === 1 ? 'LEGAL' : 'SUPERVISOR',
        deadline: new Date(Number(m.deadline) * 1000).toISOString(),
        released: m.released,
        state: m.released ? 'RELEASED'
          : i === onChain.nextMilestone ? (onChain.status === 2 ? 'IN_REVIEW' : 'PENDING')
          : 'PENDING',
        // El tramo se calcula sobre lo RECAUDADO, no sobre la meta: si la ronda
        // cerró por encima del objetivo, cada hito libera proporcionalmente más.
        amount: ((onChain.raised * BigInt(m.bps)) / 10_000n).toString(),
      })),
      events: eventsFor(project.onChainId),
    };
  });

  // ------------------------------------------------------------- evidencia

  app.post('/api/projects/:id/evidence', async (request, reply) => {
    const { id } = request.params as { id: string };
    const project = getProject(id);
    if (!project) return reply.code(404).send({ error: 'Proyecto inexistente' });

    const body = request.body as {
      milestoneIndex: number; kind: string; filename: string; contentType: string;
      sizeBytes: number; sha256: string; ipfsCid?: string; uploadedBy: string; notes?: string;
      contentBase64?: string;
    };

    const evidence = addEvidence({
      projectId: project.id,
      milestoneIndex: body.milestoneIndex,
      kind: body.kind as never,
      filename: body.filename,
      contentType: body.contentType,
      sizeBytes: body.sizeBytes,
      sha256: body.sha256,
      ipfsCid: body.ipfsCid ?? null,
      uploadedBy: body.uploadedBy,
      notes: body.notes ?? '',
      content: body.contentBase64 ? Buffer.from(body.contentBase64, 'base64') : undefined,
    });

    // Pin a IPFS en background — fire and forget. Si falla, el registro queda
    // con ipfsCid = null y se puede reintentar con POST /api/evidence/:id/pin.
    if (body.contentBase64 && ipfsConfigured()) {
      const buf = Buffer.from(body.contentBase64, 'base64');
      void pinAndUpdate(evidence.id, buf, body.filename, project.id).catch((err) => {
        console.warn(`[ipfs] falló el pin de ${evidence.id}:`, err);
      });
    }

    return reply.code(201).send({ evidence, ipfs: ipfsConfigured() ? 'pinning' : 'not_configured' });
  });

  /** Reintenta el pin de una evidencia que no llegó a IPFS. */
  app.post('/api/evidence/:id/pin', async (request, reply) => {
    const { id } = request.params as { id: string };
    // Buscamos la evidencia en todas las del proyecto — no tenemos el projectId
    // en esta ruta, así que buscamos directo en la base.
    const row = (await import('../db.ts')).db()
      .prepare('SELECT * FROM evidence WHERE id = ?').get(id) as { project_id: string; filename: string; ipfs_cid: string | null } | undefined;
    if (!row) return reply.code(404).send({ error: 'Evidencia inexistente' });
    if (row.ipfs_cid) return { cid: row.ipfs_cid, url: gatewayUrl(row.ipfs_cid) };
    if (!ipfsConfigured()) return reply.code(503).send({ error: 'IPFS no configurado. Seteá PINATA_JWT.' });
    // No tenemos el contenido en la base (se guarda en memoria durante el upload).
    // Para reintentar habría que resubirlo.
    return reply.code(409).send({ error: 'El contenido no está disponible para re-pin. Subí la evidencia de nuevo.' });
  });

  app.get('/api/projects/:id/evidence/:milestoneIndex/bundle', async (request, reply) => {
    const { id, milestoneIndex } = request.params as { id: string; milestoneIndex: string };
    const project = getProject(id);
    if (!project) return reply.code(404).send({ error: 'Proyecto inexistente' });
    const index = Number(milestoneIndex);
    return {
      milestoneIndex: index,
      evidence: listEvidence(project.id, index),
      bundleHash: evidenceBundleHash(project.id, index),
    };
  });
}

function updateProjectChainRefs(project: ProjectDossier, vault: string, chainId: number) {
  return setPlatformFields(project.id, { vaultAddress: vault, chainId });
}

export { DomainError };
