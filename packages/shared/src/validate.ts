// ---------------------------------------------------------------------------
//  Validación del dossier — la barrera entre "un formulario" y "un proyecto"
// ---------------------------------------------------------------------------
//
//  Estas reglas no son validación de formulario. Cada una corresponde a una
//  forma concreta en que un proyecto mal armado le cuesta plata a alguien, y
//  varias replican del lado del servidor una condición que el contrato también
//  exige: es mejor rechazar un proyecto con un mensaje legible que quemar gas
//  para que `HitosInvalidos()` reviente sin explicar nada.

import {
  type ProjectDossier, type MilestoneSpec, type SourcesAndUses,
  totalSources, totalUses,
} from './dossier.js';

export interface ValidationIssue {
  field: string;
  message: string;
  severity: 'ERROR' | 'WARNING';
}

/** Topes grabados en `ProjectVault`. Duplicados acá a propósito: si alguien los
 *  sube en el backend, el contrato igual rechaza. La verdad está en el bytecode. */
export const MAX_ORIGINATION_BPS = 300;
export const MAX_SUCCESS_BPS = 2000;

export function validateMilestones(milestones: MilestoneSpec[]): ValidationIssue[] {
  const issues: ValidationIssue[] = [];

  if (milestones.length === 0) {
    issues.push({ field: 'milestones', message: 'El proyecto necesita al menos un hito.', severity: 'ERROR' });
    return issues;
  }

  // El contrato exige suma exacta 10 000. No 9 999 por redondear al escribir.
  const sum = milestones.reduce((acc, m) => acc + m.bps, 0);
  if (sum !== 10_000) {
    issues.push({
      field: 'milestones',
      message: `Los tramos suman ${sum} bps; deben sumar exactamente 10000 (100 %). Diferencia: ${sum - 10_000} bps.`,
      severity: 'ERROR',
    });
  }

  for (const m of milestones) {
    if (m.bps <= 0) {
      issues.push({ field: `milestones[${m.index}].bps`, message: 'Un hito no puede liberar 0.', severity: 'ERROR' });
    }
    if (m.requiredEvidence.length === 0) {
      // Sin evidencia pactada, el verificador firma lo que le pongan enfrente.
      issues.push({
        field: `milestones[${m.index}].requiredEvidence`,
        message: 'Definí qué evidencia se exige ANTES de abrir la ronda, no cuando toque cobrar.',
        severity: 'ERROR',
      });
    }
  }

  // Los hitos se liberan en orden estricto on-chain: si los plazos van al revés,
  // el hito 2 vence mientras se espera el 1 y el capital se congela solo.
  const ordered = [...milestones].sort((a, b) => a.index - b.index);
  for (let i = 1; i < ordered.length; i++) {
    const prev = ordered[i - 1]!;
    const cur = ordered[i]!;
    if (Date.parse(cur.deadline) <= Date.parse(prev.deadline)) {
      issues.push({
        field: `milestones[${cur.index}].deadline`,
        message: `El hito ${cur.index} vence antes que el ${prev.index}, pero se libera después. El capital se congelaría sin que nadie incumpla.`,
        severity: 'ERROR',
      });
    }
  }

  // Un primer tramo enorme convierte el escrow en una transferencia con pasos
  // extra: si el 80 % sale antes de que se vea un ladrillo, no hay control.
  const first = ordered[0]!;
  if (first.bps > 4_000) {
    issues.push({
      field: 'milestones[0].bps',
      message: `El primer hito libera ${(first.bps / 100).toFixed(1)} % del capital antes de cualquier verificación de obra. Por encima de 40 % el escrow deja de ser un control.`,
      severity: 'WARNING',
    });
  }

  return issues;
}

export function validateSourcesAndUses(su: SourcesAndUses): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const sources = BigInt(totalSources(su));
  const uses = BigInt(totalUses(su));

  if (sources < uses) {
    issues.push({
      field: 'sourcesAndUses',
      message: `Las fuentes (${sources}) no cubren los usos (${uses}). Faltan ${uses - sources} unidades y alguien va a tener que ponerlas.`,
      severity: 'ERROR',
    });
  }

  if (uses > 0n) {
    // Sin contingencia, el primer sobrecosto —y siempre hay uno— se come el
    // tramo del hito siguiente.
    const contingencyBps = (BigInt(su.uses.contingency) * 10_000n) / uses;
    if (contingencyBps < 500n) {
      issues.push({
        field: 'sourcesAndUses.uses.contingency',
        message: `La contingencia es ${(Number(contingencyBps) / 100).toFixed(1)} % del presupuesto. Por debajo de 5 % el primer sobrecosto se come el tramo siguiente.`,
        severity: 'WARNING',
      });
    }
  }

  // Skin in the game: si el desarrollador no arriesga nada, el único que pierde
  // cuando el proyecto se cae es el inversionista.
  const equity = BigInt(su.sources.developerEquity);
  if (uses > 0n && (equity * 10_000n) / uses < 1_000n) {
    issues.push({
      field: 'sourcesAndUses.sources.developerEquity',
      message: 'El desarrollador aporta menos del 10 % del costo total. Sin capital propio comprometido, el riesgo lo carga entero el inversionista.',
      severity: 'WARNING',
    });
  }

  return issues;
}

export function validateDossier(d: ProjectDossier): ValidationIssue[] {
  const issues: ValidationIssue[] = [
    ...validateMilestones(d.milestones),
    ...validateSourcesAndUses(d.sourcesAndUses),
  ];

  // La meta de la ronda y el renglón de fuentes tienen que ser el mismo número.
  // Si divergen, el vault levanta una cifra y el presupuesto asume otra.
  if (d.terms.target !== d.sourcesAndUses.sources.investorFinancing) {
    issues.push({
      field: 'terms.target',
      message: `La meta de la ronda (${d.terms.target}) no coincide con el financiamiento de inversionistas declarado en fuentes y usos (${d.sourcesAndUses.sources.investorFinancing}).`,
      severity: 'ERROR',
    });
  }

  if (d.terms.originationBps > MAX_ORIGINATION_BPS) {
    issues.push({
      field: 'terms.originationBps',
      message: `La comisión de originación (${d.terms.originationBps} bps) supera el tope inmutable del contrato (${MAX_ORIGINATION_BPS} bps). El despliegue va a revertir.`,
      severity: 'ERROR',
    });
  }
  if (d.terms.successBps > MAX_SUCCESS_BPS) {
    issues.push({
      field: 'terms.successBps',
      message: `La comisión de éxito (${d.terms.successBps} bps) supera el tope inmutable del contrato (${MAX_SUCCESS_BPS} bps). El despliegue va a revertir.`,
      severity: 'ERROR',
    });
  }

  if (BigInt(d.terms.minimumTicket) <= 0n) {
    issues.push({ field: 'terms.minimumTicket', message: 'El ticket mínimo debe ser mayor a cero.', severity: 'ERROR' });
  }
  if (d.terms.maximumTicket && BigInt(d.terms.maximumTicket) < BigInt(d.terms.minimumTicket)) {
    issues.push({ field: 'terms.maximumTicket', message: 'El ticket máximo es menor que el mínimo.', severity: 'ERROR' });
  }

  // El primer hito no puede vencer antes de que cierre la ronda: nadie puede
  // acreditar avance con el capital todavía sin recaudar.
  const firstDeadline = [...d.milestones].sort((a, b) => a.index - b.index)[0]?.deadline;
  if (firstDeadline && Date.parse(firstDeadline) <= Date.parse(d.terms.fundingDeadline)) {
    issues.push({
      field: 'milestones[0].deadline',
      message: 'El primer hito vence antes de que cierre la ronda. Nadie puede acreditar obra con el capital sin recaudar.',
      severity: 'ERROR',
    });
  }

  // Cada rol que los hitos exigen tiene que tener un verificador registrado, o
  // el hito queda imposible de acreditar y termina venciendo.
  const rolesRequired = new Set(d.milestones.map((m) => m.role));
  const rolesAvailable = new Set(d.verifiers.map((v) => v.role));
  for (const role of rolesRequired) {
    if (!rolesAvailable.has(role)) {
      issues.push({
        field: 'verifiers',
        message: `Hay hitos que exigen un verificador ${role} y no hay ninguno registrado. Esos hitos vencerían sin poder acreditarse.`,
        severity: 'ERROR',
      });
    }
  }

  // Gravámenes por delante de los inversionistas: no invalida el proyecto, pero
  // el inversionista tiene que verlo antes de poner la plata, no después.
  const seniorLiens = d.property.encumbrances.filter((e) => e.rank === 1);
  if (seniorLiens.length > 0) {
    issues.push({
      field: 'property.encumbrances',
      message: `El inmueble tiene ${seniorLiens.length} gravamen(es) de primer rango: ese acreedor cobra antes que los inversionistas en caso de ejecución.`,
      severity: 'WARNING',
    });
  }
  if (d.property.certificateVerifiedAt === null) {
    issues.push({
      field: 'property.certificateVerifiedAt',
      message: 'No hay certificado de gravámenes verificado. "Sin gravámenes declarados" no es lo mismo que "libre de gravámenes".',
      severity: 'ERROR',
    });
  }

  return issues;
}

export function hasBlockingIssues(issues: ValidationIssue[]): boolean {
  return issues.some((i) => i.severity === 'ERROR');
}
