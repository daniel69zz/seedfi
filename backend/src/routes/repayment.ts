// ---------------------------------------------------------------------------
//  API de repayment waterfall  (backlog T19 — stretch)
// ---------------------------------------------------------------------------
import type { FastifyInstance } from 'fastify';
import type { Address } from 'viem';
import { getProject } from '../store/projects.ts';
import { computeSchedule, saveSchedule, getSchedule, markPaid, overdueInstallments } from '../store/waterfall.ts';
import { deployment, operatorClient, publicClient, projectVaultAbi } from '../chain.ts';

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
    const { client, address } = operatorClient();

    // En la demo, el operador ejecuta con su propia llave.
    // En producción, el builder aprueba y envía desde su wallet.
    const amount = BigInt(installment.amount);

    const hash = await client.writeContract({
      address: deployed.vault as Address, abi: projectVaultAbi, functionName: 'repay',
      args: [BigInt(project.onChainId), amount],
      chain: null, account: address,
    });
    const receipt = await pub.waitForTransactionReceipt({ hash });

    if (receipt.status !== 'success') {
      return reply.code(400).send({ error: `La transacción de repago revirtió: ${hash}` });
    }

    const updated = markPaid(project.id, Number(index), amount.toString(), hash);
    return { schedule: serialize(updated), txHash: hash };
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
