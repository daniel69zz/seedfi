// ---------------------------------------------------------------------------
//  API de repayment waterfall  (backlog T19 — stretch)
// ---------------------------------------------------------------------------
import type { FastifyInstance } from 'fastify';
import { parseEventLogs, type Address, type Hex } from 'viem';
import { getProject } from '../store/projects.ts';
import { computeSchedule, saveSchedule, getSchedule, markPaid, overdueInstallments } from '../store/waterfall.ts';
import { CONFIRMATIONS, deployment, operatorClient, publicClient, projectVaultAbi } from '../chain.ts';

export async function repaymentRoutes(app: FastifyInstance): Promise<void> {
  /**
   * Genera el schedule de repago para un proyecto publicado.
   *
   * Se puede llamar cuantas veces se quiera: si ya existe, lo devuelve sin
   * recrearlo. Para forzar un recálculo (porque cambiaron los términos en la
   * base antes de publicar), mandá `force: true`.
   */
  app.post('/api/projects/:id/repayment/schedule', async (request, reply) => {
    const { id } = request.params as { id: string };
    const { force } = request.body as { force?: boolean } || {};

    const project = getProject(id);
    if (!project) return reply.code(404).send({ error: 'Proyecto inexistente' });

    let schedule = getSchedule(project.id);
    if (schedule && !force) {
      return { schedule: serialize(schedule) };
    }

    schedule = computeSchedule(project);
    saveSchedule(schedule);
    return { schedule: serialize(schedule) };
  });

  /** Lee el schedule vigente. */
  app.get('/api/projects/:id/repayment/schedule', async (request, reply) => {
    const { id } = request.params as { id: string };
    const project = getProject(id);
    if (!project) return reply.code(404).send({ error: 'Proyecto inexistente' });

    const schedule = getSchedule(project.id);
    if (!schedule) return reply.code(404).send({ error: 'No hay schedule de repago. Generalo con POST.' });
    return { schedule: serialize(schedule), overdue: overdueInstallments(project.id) };
  });

  /**
   * Ejecuta el repago de una cuota específica.
   *
   * En la demo esto lo manda el operador (o un cron). En producción el builder
   * firmaría la transacción desde su wallet — el operador no puede mover
   * fondos del builder.
   *
   * El flujo es: el builder aprueba el USDT al vault, y luego este endpoint
   * (o el builder directamente) llama a `vault.repay()`.
   */
  app.post('/api/projects/:id/repayment/:index/pay', async (request, reply) => {
    const { id, index } = request.params as { id: string; index: string };

    const project = getProject(id);
    if (!project) return reply.code(404).send({ error: 'Proyecto inexistente' });

    const schedule = getSchedule(project.id);
    if (!schedule) return reply.code(404).send({ error: 'No hay schedule de repago.' });

    const installment = schedule.installments[Number(index)];
    if (!installment) return reply.code(404).send({ error: `Cuota ${index} inexistente.` });
    if (installment.status === 'PAID') return reply.code(409).send({ error: 'La cuota ya fue pagada.', txHash: installment.txHash });

    const deployed = deployment();
    const pub = publicClient();
    const { client } = operatorClient();

    // En la demo, el operador ejecuta con su propia llave.
    // En producción, el builder aprueba y envía desde su wallet.
    const amount = BigInt(installment.amount);

    const hash = await client.writeContract({
      address: deployed.vault as Address, abi: projectVaultAbi, functionName: 'repay',
      args: [BigInt(project.onChainId), amount],
      chain: null, account: client.account!,
    });
    const receipt = await pub.waitForTransactionReceipt({ hash, confirmations: CONFIRMATIONS });

    if (receipt.status !== 'success') {
      return reply.code(400).send({ error: `La transacción de repago revirtió: ${hash}` });
    }

    const updated = markPaid(project.id, Number(index), amount.toString(), hash);
    return { schedule: serialize(updated), txHash: hash };
  });

  /**
   * Registra una cuota que la constructora YA pagó desde su wallet.
   *
   * No firma nada: lee el recibo y solo marca la cuota si la cadena lo
   * respalda — tx exitosa, dirigida al vault, con un `Repaid` de ESTE proyecto
   * por al menos el monto de la cuota. Sin esa verificación, cualquiera podría
   * marcar cuotas como pagadas mandando un hash cualquiera.
   *
   * Existe porque `/pay` manda su propio `repay` con la llave del operador: si
   * la UI ya pagó desde la wallet y además llama a `/pay`, se paga dos veces.
   */
  app.post('/api/projects/:id/repayment/:index/confirm', async (request, reply) => {
    const { id, index } = request.params as { id: string; index: string };
    const { txHash } = (request.body ?? {}) as { txHash?: string };
    if (!txHash || !/^0x[0-9a-fA-F]{64}$/.test(txHash)) return reply.code(400).send({ error: 'txHash inválido.' });

    const project = getProject(id);
    if (!project) return reply.code(404).send({ error: 'Proyecto inexistente' });
    const schedule = getSchedule(project.id);
    if (!schedule) return reply.code(404).send({ error: 'No hay schedule de repago.' });
    const installment = schedule.installments[Number(index)];
    if (!installment) return reply.code(404).send({ error: `Cuota ${index} inexistente.` });
    if (installment.status === 'PAID') return reply.code(409).send({ error: 'La cuota ya fue pagada.', txHash: installment.txHash });
    if (schedule.installments.some((i) => i.txHash?.toLowerCase() === txHash.toLowerCase())) {
      return reply.code(409).send({ error: 'Esa transacción ya respalda otra cuota.' });
    }

    const deployed = deployment();
    const receipt = await publicClient().waitForTransactionReceipt({ hash: txHash as Hex, confirmations: CONFIRMATIONS });
    if (receipt.status !== 'success') return reply.code(400).send({ error: `La transacción revirtió: ${txHash}` });
    if (receipt.to?.toLowerCase() !== deployed.vault.toLowerCase()) {
      return reply.code(400).send({ error: 'La transacción no fue enviada al vault.' });
    }

    const repaid = parseEventLogs({ abi: projectVaultAbi, logs: receipt.logs, eventName: 'Repaid' })
      .filter((log) => log.address.toLowerCase() === deployed.vault.toLowerCase())
      .filter((log) => (log.args as { projectId: bigint }).projectId === BigInt(project.onChainId))
      .reduce((acc, log) => acc + (log.args as { amount: bigint }).amount, 0n);
    if (repaid < BigInt(installment.amount)) {
      return reply.code(400).send({ error: `El repago en cadena (${repaid}) no cubre la cuota (${installment.amount}).` });
    }

    const updated = markPaid(project.id, Number(index), repaid.toString(), txHash);
    return { schedule: serialize(updated), txHash };
  });

  /**
   * Lista las cuotas vencidas de todos los proyectos con schedule.
   *
   * Útil para un dashboard de administración o un cron que notifique a los
   * builders morosos.
   */
  app.get('/api/repayments/overdue', async () => {
    const db = (await import('../db.ts')).db();
    const rows = db.prepare('SELECT project_id FROM repayment_schedules').all() as { project_id: string }[];
    const result: { projectId: string; overdue: ReturnType<typeof overdueInstallments> }[] = [];
    for (const row of rows) {
      const overdue = overdueInstallments(row.project_id);
      if (overdue.length > 0) result.push({ projectId: row.project_id, overdue });
    }
    return { overdue: result };
  });
}

function serialize(schedule: ReturnType<typeof getSchedule>) {
  if (!schedule) return null;
  return {
    ...schedule,
    totalDue: schedule.totalDue.toString(),
    installment: schedule.installment.toString(),
  };
}
