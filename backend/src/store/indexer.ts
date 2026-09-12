// ---------------------------------------------------------------------------
//  Indexador de eventos
// ---------------------------------------------------------------------------
//
//  La cadena es la autoridad sobre el dinero; esta tabla es solo una copia para
//  poder consultarla rápido. Por eso el indexador NUNCA escribe a la cadena y
//  siempre puede reconstruirse borrando `chain_events` y volviendo a correr.
//
//  La clave primaria es `txHash:logIndex`, que es único e inmutable en la
//  cadena. Con eso, procesar el mismo rango dos veces —por un reinicio, una
//  reorg corta o un cursor mal guardado— no duplica nada.

import { db, now } from '../db.ts';
import { fetchEvents, publicClient, deployment, statusName, readProject, ChainUnavailableError } from '../chain.ts';
import { getProject, transition } from './projects.ts';
import type { ProjectStatus } from '@s2d/shared';

export interface SyncResult {
  fromBlock: number;
  toBlock: number;
  events: number;
  statusChanges: { projectId: string; from: string; to: string }[];
}

function cursor(): number {
  const row = db().prepare('SELECT last_block FROM sync_cursor WHERE id = 1').get() as { last_block: number } | undefined;
  return row?.last_block ?? 0;
}

function saveCursor(block: number): void {
  db().prepare('INSERT INTO sync_cursor (id,last_block) VALUES (1,?) ON CONFLICT(id) DO UPDATE SET last_block=excluded.last_block')
    .run(block);
}

export async function sync(): Promise<SyncResult> {
  const deployed = deployment();
  const head = await publicClient().getBlockNumber();
  // Nunca antes del bloque del despliegue: escanear desde el 0 en una red real
  // son millones de bloques de nada.
  const from = BigInt(Math.max(cursor() + 1, deployed.blockNumber));

  if (from > head) {
    return { fromBlock: Number(from), toBlock: Number(head), events: 0, statusChanges: [] };
  }

  const events = await fetchEvents(from, head);
  const insert = db().prepare(
    `INSERT OR IGNORE INTO chain_events (id, project_id, on_chain_id, kind, block_number, tx_hash, log_index, payload, observed_at)
     VALUES (?,?,?,?,?,?,?,?,?)`,
  );

  const touched = new Set<number>();
  for (const e of events) {
    const project = e.onChainId != null ? findByOnChainId(e.onChainId) : null;
    insert.run(`${e.txHash}:${e.logIndex}`, project?.id ?? null, e.onChainId, e.kind,
               e.blockNumber, e.txHash, e.logIndex, JSON.stringify(e.payload), now());
    if (e.onChainId != null) touched.add(e.onChainId);
  }

  const statusChanges = await reconcileStatuses([...touched]);
  saveCursor(Number(head));

  return { fromBlock: Number(from), toBlock: Number(head), events: events.length, statusChanges };
}

/**
 * Alinea el estado del dossier con el del vault.
 *
 * Se lee `projects()` en vez de deducirlo de los eventos: el estado actual es
 * un dato único y autoritativo, mientras que deducirlo de una secuencia de
 * eventos es exactamente el tipo de reconstrucción que se desincroniza en
 * cuanto falta uno.
 */
async function reconcileStatuses(onChainIds: number[]) {
  const changes: { projectId: string; from: string; to: string }[] = [];

  for (const onChainId of onChainIds) {
    const dossier = findByOnChainId(onChainId);
    if (!dossier) continue;

    const onChain = await readProject(onChainId);
    if (!onChain) continue;

    // `readProject` ya devolvió null para Status.NONE, así que acá siempre hay
    // un estado real del vault.
    const target = statusName(onChain.status) as ProjectStatus;
    if (target !== dossier.status) {
      // `force`: acá la cadena manda. El backend refleja, no discute.
      transition(dossier.id, target, { force: true });
      changes.push({ projectId: dossier.id, from: dossier.status, to: target });
    }
  }
  return changes;
}

function findByOnChainId(onChainId: number) {
  const row = db().prepare('SELECT id FROM projects WHERE on_chain_id = ?').get(onChainId) as { id: string } | undefined;
  return row ? getProject(row.id) : null;
}

export function eventsFor(onChainId: number) {
  return db().prepare('SELECT * FROM chain_events WHERE on_chain_id = ? ORDER BY block_number, log_index')
    .all(onChainId)
    .map((r) => {
      const row = r as unknown as Record<string, never>;
      return {
        kind: row.kind, blockNumber: row.block_number, txHash: row.tx_hash,
        logIndex: row.log_index, payload: JSON.parse(row.payload as unknown as string),
        observedAt: row.observed_at,
      };
    });
}

/** Arranca el bucle de sincronización. Un error de red NO tumba el servidor:
 *  la cadena puede estar caída y la API de dossiers sigue sirviendo. */
export function startSyncLoop(intervalMs = 4000): () => void {
  let stopped = false;
  const tick = async () => {
    if (stopped) return;
    try {
      await sync();
    } catch (error) {
      if (!(error instanceof ChainUnavailableError)) {
        console.warn('[indexer]', error instanceof Error ? error.message : error);
      }
    }
    if (!stopped) setTimeout(tick, intervalMs);
  };
  setTimeout(tick, 500);
  return () => { stopped = true; };
}
