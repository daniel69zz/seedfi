// ---------------------------------------------------------------------------
//  Waterfall automático de repayment  (backlog T19 — stretch)
// ---------------------------------------------------------------------------
//
//  El vault ya separa capital de retorno y cobra la comisión de éxito solo sobre
//  la ganancia (ProjectVault.repay). Lo que falta es la ORQUESTACIÓN: que el
//  backend pueda calcular y ejecutar cuotas de repago según un calendario, y
//  que si alguna cuota falla, el siguiente intento la incluya.
//
//  ¿Por qué acá y no en el contrato? Porque el contrato no tiene reloj: no hay
//  forma de que se llame a sí mismo después de 30 días. Lo que hacemos es:
//
//    1. Calcular el schedule a partir de los términos del proyecto.
//    2. Exponer una ruta que el operador (o un cron) invoca para ejecutar la
//       cuota pendiente.
//    3. Registrar cada cuota en la base para auditoría.
//
//  El contrato sigue siendo la verdad: cada `repay` es una transacción firmada
//  por el builder (no por el operador), con un receipt verificable.

import { db, now } from '../db.ts';
import type { ProjectDossier } from '@s2d/shared';
import { getProject } from './projects.ts';

// ------------------------------------------------------------------ schema

export interface RepaymentSchedule {
  projectId: string;
  onChainId: number;
  /** Total a repagar: capital + intereses. */
  totalDue: bigint;
  /** Cuota periódica antes de la última (que absorbe el residuo). */
  installment: bigint;
  /** Número total de cuotas. */
  periods: number;
  /** Intervalo entre cuotas en milisegundos. */
  intervalMs: number;
  /** Fecha de inicio del calendario. */
  startDate: string;
  /** Cuotas generadas. */
  installments: RepaymentInstallment[];
}

export interface RepaymentInstallment {
  index: number;
  dueDate: string;
  amount: string;
  /** Capital de esta cuota. */
  capitalPortion: string;
  /** Interés de esta cuota. */
  interestPortion: string;
  status: 'PENDING' | 'PAID' | 'OVERDUE' | 'PARTIAL';
  paidAmount: string;
  paidAt: string | null;
  txHash: string | null;
}

// ------------------------------------------------------------------ cálculo

/**
 * Calcula el calendario de repago para un proyecto.
 *
 * El modelo es BULLET simplificado: cuotas iguales de capital + interés, con
 * la última absorbiendo el residuo de la división entera. El interés se calcula
 * simple (no compuesto) sobre el monto total financiado.
 *
 * Es un stretch goal de demo — un modelo de producción usaría amortización
 * francesa o personalizada por proyecto.
 */
export function computeSchedule(project: ProjectDossier): RepaymentSchedule {
  const target = BigInt(project.terms.target);
  const interestBps = project.terms.interestBps;
  const termMonths = project.terms.termMonths;

  // Interés simple anual prorrateado al plazo.
  const totalInterest = (target * BigInt(interestBps) * BigInt(termMonths)) / (10_000n * 12n);
  const totalDue = target + totalInterest;

  // Cuotas mensuales.
  const periods = termMonths;
  const installment = totalDue / BigInt(periods);
  const capitalPerPeriod = target / BigInt(periods);
  const interestPerPeriod = totalInterest / BigInt(periods);

  // Fecha de inicio: el publishing del proyecto o ahora si no se publicó.
  const startDate = project.publishedAt ?? now();
  const intervalMs = 30 * 24 * 60 * 60 * 1000; // ~1 mes

  const installments: RepaymentInstallment[] = [];
  let capitalRemaining = target;
  let interestRemaining = totalInterest;

  for (let i = 0; i < periods; i++) {
    const isLast = i === periods - 1;
    const cap = isLast ? capitalRemaining : capitalPerPeriod;
    const int = isLast ? interestRemaining : interestPerPeriod;
    const amount = cap + int;

    installments.push({
      index: i,
      dueDate: new Date(Date.parse(startDate) + (i + 1) * intervalMs).toISOString(),
      amount: amount.toString(),
      capitalPortion: cap.toString(),
      interestPortion: int.toString(),
      status: 'PENDING',
      paidAmount: '0',
      paidAt: null,
      txHash: null,
    });

    capitalRemaining -= cap;
    interestRemaining -= int;
  }

  return {
    projectId: project.id,
    onChainId: project.onChainId,
    totalDue,
    installment,
    periods,
    intervalMs,
    startDate,
    installments,
  };
}

// ---------------------------------------------------------------- persistencia

/** Guarda o actualiza el schedule en la base. */
export function saveSchedule(schedule: RepaymentSchedule): void {
  const stmt = db().prepare(
    `INSERT OR REPLACE INTO repayment_schedules (project_id, on_chain_id, total_due, installment, periods, interval_ms, start_date, data, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  );
  stmt.run(
    schedule.projectId, schedule.onChainId, schedule.totalDue.toString(),
    schedule.installment.toString(), schedule.periods, schedule.intervalMs,
    schedule.startDate, JSON.stringify(schedule.installments), now(),
  );
}

/** Lee el schedule de un proyecto. */
export function getSchedule(projectId: string): RepaymentSchedule | null {
  const row = db().prepare('SELECT * FROM repayment_schedules WHERE project_id = ?').get(projectId) as {
    project_id: string; on_chain_id: number; total_due: string; installment: string;
    periods: number; interval_ms: number; start_date: string; data: string;
  } | undefined;
  if (!row) return null;
  return {
    projectId: row.project_id,
    onChainId: row.on_chain_id,
    totalDue: BigInt(row.total_due),
    installment: BigInt(row.installment),
    periods: row.periods,
    intervalMs: row.interval_ms,
    startDate: row.start_date,
    installments: JSON.parse(row.data) as RepaymentInstallment[],
  };
}

/**
 * Marca una cuota como pagada.
 *
 * Se llama DESPUÉS de que la transacción `repay` se confirmó en cadena. El
 * txHash es la prueba: alguien que quiera verificar puede leer el recibo.
 */
export function markPaid(projectId: string, index: number, amount: string, txHash: string): RepaymentSchedule {
  const schedule = getSchedule(projectId);
  if (!schedule) throw new Error('No hay schedule para este proyecto.');
  const installment = schedule.installments[index];
  if (!installment) throw new Error(`Cuota ${index} inexistente.`);

  installment.status = 'PAID';
  installment.paidAmount = amount;
  installment.paidAt = now();
  installment.txHash = txHash;

  saveSchedule(schedule);
  return schedule;
}

/**
 * Retorna las cuotas vencidas y no pagadas.
 */
export function overdueInstallments(projectId: string): RepaymentInstallment[] {
  const schedule = getSchedule(projectId);
  if (!schedule) return [];
  const today = Date.now();
  return schedule.installments.filter(
    (i) => i.status === 'PENDING' && Date.parse(i.dueDate) < today,
  );
}
