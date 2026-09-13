// ---------------------------------------------------------------------------
//  API del verificador — firmar hitos y liberar tramos  (backlog T10)
// ---------------------------------------------------------------------------
import type { FastifyInstance } from 'fastify';
import type { Address, Hex } from 'viem';
import { createAttestation, listAttestations, getAttestation, markSubmitted } from '../store/attestations.ts';
import { getProject, listEvidence, evidenceBundleHash } from '../store/projects.ts';
import { CONFIRMATIONS, deployment, operatorClient, publicClient, projectVaultAbi } from '../chain.ts';
import { sync } from '../store/indexer.ts';

export async function verificationRoutes(app: FastifyInstance): Promise<void> {
  /** La bandeja del verificador: qué hito toca y con qué evidencia. */
  app.get('/api/projects/:id/milestones/:index/review', async (request, reply) => {
    const { id, index } = request.params as { id: string; index: string };
    const project = getProject(id);
    if (!project) return reply.code(404).send({ error: 'Proyecto inexistente' });

    const milestoneIndex = Number(index);
    const milestone = project.milestones.find((m) => m.index === milestoneIndex);
    if (!milestone) return reply.code(404).send({ error: `El proyecto no tiene un hito ${milestoneIndex}.` });

    const evidence = listEvidence(project.id, milestoneIndex);
    const provided = new Set(evidence.map((e) => e.kind));

    return {
      milestone,
      evidence,
      // Qué se pactó exigir y qué falta. El verificador no tiene que recordar
      // de memoria qué se acordó hace ocho meses al abrir la ronda.
      requiredEvidence: milestone.requiredEvidence,
      missingKinds: milestone.requiredEvidence.filter((k) => !provided.has(k as never)),
      bundleHash: evidence.length > 0 ? evidenceBundleHash(project.id, milestoneIndex) : null,
      attestations: listAttestations(project.id, milestoneIndex),
      verifiers: project.verifiers,
    };
  });

  /**
   * El verificador firma.
   *
   * `verifierKey` viaja en el cuerpo SOLO en este entorno de demo. En producción
   * la firma se produce en la wallet del verificador —Metamask, un hardware
   * wallet, una multisig— y acá llega firmada. Una plataforma que custodia las
   * llaves de sus verificadores puede acreditar sus propios hitos, y toda la
   * separación entre operar y acreditar se vuelve decorativa.
   */
  app.post('/api/projects/:id/milestones/:index/attest', async (request, reply) => {
    const { id, index } = request.params as { id: string; index: string };
    const { approved, verifierKey } = request.body as { approved: boolean; verifierKey: Hex };

    const attestation = await createAttestation({
      projectId: id, milestoneIndex: Number(index), approved, verifierKey,
    });
    return reply.code(201).send({ attestation });
  });

  /** Recibe una attestation ya firmada por fuera (el camino de producción). */
  app.post('/api/attestations', async (request, reply) => {
    const body = request.body as { digest: string };
    const existing = getAttestation(body.digest);
    if (existing) return { attestation: existing };
    return reply.code(501).send({
      error: 'La recepción de firmas externas todavía no está implementada. Usá /attest en la demo.',
    });
  });

  /**
   * Manda la attestation a la cadena.
   *
   * Lo importante: esto es una COMODIDAD. `releaseMilestone` autoriza por la
   * firma y no por el remitente, así que cualquiera puede transmitirla —el
   * desarrollador desde su wallet, un inversionista, un script—. Si este
   * servidor se cae, un tramo ya firmado sigue siendo liberable.
   */
  app.post('/api/attestations/:digest/submit', async (request, reply) => {
    const { digest } = request.params as { digest: string };
    const stored = getAttestation(digest);
    if (!stored) return reply.code(404).send({ error: 'Attestation inexistente' });
    if (stored.submittedTx) return reply.code(409).send({ error: 'Ya fue transmitida.', txHash: stored.submittedTx });

    const project = getProject(stored.projectId);
    if (!project) return reply.code(404).send({ error: 'Proyecto inexistente' });

    const message = {
      projectId: BigInt(project.onChainId),
      milestoneIndex: stored.milestoneIndex,
      evidenceHash: stored.evidenceHash as Hex,
      approved: stored.approved,
      nonce: BigInt(stored.nonce),
      expiresAt: BigInt(stored.expiresAt),
    };

    const { client } = operatorClient();
    const hash = await client.writeContract({
      address: deployment().vault as Address,
      abi: projectVaultAbi,
      functionName: stored.approved ? 'releaseMilestone' : 'failMilestone',
      args: [message, stored.signature as Hex],
      chain: null, account: client.account!,
    });
    const receipt = await publicClient().waitForTransactionReceipt({ hash, confirmations: CONFIRMATIONS });
    markSubmitted(digest, hash);
    await sync();

    return { txHash: hash, blockNumber: Number(receipt.blockNumber), status: receipt.status };
  });

  /**
   * Congela el capital de un hito vencido.
   *
   * `expireMilestone` es permissionless en el contrato: no hace falta que el
   * operador, la constructora ni el verificador reconozcan el incumplimiento.
   * Esta ruta es un atajo de UI; cualquiera puede llamar al contrato directo,
   * y ese es justamente el punto.
   */
  app.post('/api/projects/:id/expire', async (request, reply) => {
    const { id } = request.params as { id: string };
    const project = getProject(id);
    if (!project) return reply.code(404).send({ error: 'Proyecto inexistente' });

    const { client } = operatorClient();
    const hash = await client.writeContract({
      address: deployment().vault as Address, abi: projectVaultAbi, functionName: 'expireMilestone',
      args: [BigInt(project.onChainId)], chain: null, account: client.account!,
    });
    await publicClient().waitForTransactionReceipt({ hash, confirmations: CONFIRMATIONS });
    await sync();
    return { txHash: hash };
  });
}
