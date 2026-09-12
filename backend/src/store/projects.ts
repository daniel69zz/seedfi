// ---------------------------------------------------------------------------
//  Proyectos y su expediente
// ---------------------------------------------------------------------------
import { randomUUID, createHash } from 'node:crypto';
import type { ProjectDossier, ProjectStatus, Evidence } from '@s2d/shared';
import { EDITABLE_STATUSES, validateDossier, hasBlockingIssues } from '@s2d/shared';
import { db, now } from '../db.ts';

/** @dev Campos declarados aparte y no como parameter properties: el
 *  type-stripping de Node no soporta esa sintaxis, y el backend corre en
 *  desarrollo sin paso de compilación. */
export class DomainError extends Error {
  readonly statusCode: number;
  readonly details?: unknown;

  constructor(message: string, statusCode = 400, details?: unknown) {
    super(message);
    this.name = 'DomainError';
    this.statusCode = statusCode;
    this.details = details;
  }
}

interface ProjectRow {
  id: string; on_chain_id: number; name: string; status: string;
  developer_id: string; city: string; dossier: string;
  created_at: string; updated_at: string; published_at: string | null;
}

function hydrate(row: ProjectRow): ProjectDossier {
  // El dossier serializado es la verdad; las columnas sueltas existen solo para
  // filtrar e indexar. Si alguna vez divergen, gana el dossier.
  return { ...(JSON.parse(row.dossier) as ProjectDossier), status: row.status as ProjectStatus };
}

export function listProjects(filter?: { status?: ProjectStatus[]; developerId?: string }): ProjectDossier[] {
  let sql = 'SELECT * FROM projects';
  const conditions: string[] = [];
  const params: unknown[] = [];

  if (filter?.status?.length) {
    conditions.push(`status IN (${filter.status.map(() => '?').join(',')})`);
    params.push(...filter.status);
  }
  if (filter?.developerId) {
    conditions.push('developer_id = ?');
    params.push(filter.developerId);
  }
  if (conditions.length) sql += ` WHERE ${conditions.join(' AND ')}`;
  sql += ' ORDER BY created_at DESC';

  return db().prepare(sql).all(...params as never[]).map((r) => hydrate(r as unknown as ProjectRow));
}

export function getProject(id: string): ProjectDossier | null {
  const row = db().prepare('SELECT * FROM projects WHERE id = ? OR on_chain_id = ?').get(id, Number(id) || -1);
  return row ? hydrate(row as unknown as ProjectRow) : null;
}

/** Siguiente `onChainId` libre. Nunca se reutiliza: en el vault, un id usado
 *  queda ocupado para siempre y `createProject` revierte si se repite. */
export function nextOnChainId(): number {
  const row = db().prepare('SELECT MAX(on_chain_id) AS m FROM projects').get() as { m: number | null };
  return (row.m ?? 0) + 1;
}

export function createProject(input: Omit<ProjectDossier, 'id' | 'onChainId' | 'createdAt' | 'updatedAt' | 'publishedAt' | 'status'>): ProjectDossier {
  const timestamp = now();
  const dossier: ProjectDossier = {
    ...input,
    id: `S2D-${randomUUID().slice(0, 8)}`,
    onChainId: nextOnChainId(),
    status: 'DRAFT',
    createdAt: timestamp,
    updatedAt: timestamp,
    publishedAt: null,
  };

  db().prepare(
    `INSERT INTO projects (id, on_chain_id, name, status, developer_id, city, dossier, created_at, updated_at, published_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NULL)`,
  ).run(dossier.id, dossier.onChainId, dossier.name, dossier.status, dossier.developer.id, dossier.city,
        JSON.stringify(dossier), timestamp, timestamp);

  return dossier;
}

export function updateProject(id: string, patch: Partial<ProjectDossier>): ProjectDossier {
  const current = getProject(id);
  if (!current) throw new DomainError('Proyecto inexistente', 404);
  if (!EDITABLE_STATUSES.includes(current.status)) {
    throw new DomainError(
      `El proyecto está en ${current.status} y ya no se puede editar. Un dossier con capital comprometido —o en revisión— no cambia bajo los pies de quien lo está evaluando.`,
      409,
    );
  }

  // `id`, `onChainId` y `status` no se tocan por patch: el id ya puede estar
  // referenciado en cadena, y el estado se mueve por las transiciones de abajo.
  const next: ProjectDossier = {
    ...current, ...patch,
    id: current.id, onChainId: current.onChainId, status: current.status,
    createdAt: current.createdAt, updatedAt: now(),
  };

  db().prepare('UPDATE projects SET name=?, city=?, dossier=?, updated_at=? WHERE id=?')
    .run(next.name, next.city, JSON.stringify(next), next.updatedAt, current.id);
  return next;
}

/**
 * Campos del dossier que pertenecen A LA PLATAFORMA, no al desarrollador.
 *
 * `updateProject` congela el expediente en cuanto sale de borrador, y tiene que
 * ser así: un dossier no puede cambiar bajo los pies de quien lo está
 * evaluando, ni mucho menos con capital adentro.
 *
 * Pero tres cosas se escriben DESPUÉS de ese congelamiento y no son ediciones
 * del desarrollador: la calificación de riesgo que produce el comité, la raíz
 * de credenciales vigente al abrir la ronda, y la dirección del vault una vez
 * desplegado. Meterlas por `updateProject` obligaría a abrir un agujero en el
 * congelamiento; van por acá, acotadas a esos tres campos y a ningún otro.
 */
export function setPlatformFields(
  id: string,
  patch: Pick<Partial<ProjectDossier>, 'risk' | 'vaultAddress' | 'chainId' | 'agreementHash' | 'agreementVersion'>
    & { credentialRoot?: string },
): ProjectDossier {
  const current = getProject(id);
  if (!current) throw new DomainError('Proyecto inexistente', 404);

  const next: ProjectDossier = {
    ...current,
    risk: patch.risk !== undefined ? patch.risk : current.risk,
    vaultAddress: patch.vaultAddress !== undefined ? patch.vaultAddress : current.vaultAddress,
    chainId: patch.chainId !== undefined ? patch.chainId : current.chainId,
    agreementHash: patch.agreementHash !== undefined ? patch.agreementHash : current.agreementHash,
    agreementVersion: patch.agreementVersion !== undefined ? patch.agreementVersion : current.agreementVersion,
    eligibility: patch.credentialRoot
      ? { ...current.eligibility, credentialRoot: patch.credentialRoot }
      : current.eligibility,
    updatedAt: now(),
  };

  db().prepare('UPDATE projects SET dossier=?, updated_at=? WHERE id=?')
    .run(JSON.stringify(next), next.updatedAt, current.id);
  return next;
}

/**
 * Transiciones permitidas. Escritas como tabla y no como `if`s desparramados
 * porque este grafo ES la política de la plataforma: qué puede pasar después de
 * qué. Leerlo entero de un vistazo vale más que ahorrarse diez líneas.
 */
const TRANSITIONS: Record<ProjectStatus, ProjectStatus[]> = {
  DRAFT: ['SUBMITTED'],
  SUBMITTED: ['UNDER_REVIEW', 'CHANGES_REQUESTED', 'REJECTED'],
  UNDER_REVIEW: ['APPROVED', 'CHANGES_REQUESTED', 'REJECTED'],
  CHANGES_REQUESTED: ['SUBMITTED'],
  REJECTED: [],
  APPROVED: ['PUBLISHED'],
  PUBLISHED: ['FUNDING'],
  // De acá para abajo manda la cadena: el backend refleja, no decide.
  FUNDING: ['ACTIVE', 'ROUND_FAILED'],
  ACTIVE: ['COMPLETED', 'MILESTONE_FAILED'],
  COMPLETED: [],
  ROUND_FAILED: [],
  MILESTONE_FAILED: [],
};

export function transition(id: string, to: ProjectStatus, options?: { force?: boolean }): ProjectDossier {
  const current = getProject(id);
  if (!current) throw new DomainError('Proyecto inexistente', 404);

  // `force` es para el indexador: la cadena es la autoridad sobre FUNDING y lo
  // que sigue, y si un evento llega fuera de orden el backend se acomoda, no
  // discute. Ninguna ruta HTTP lo expone.
  if (!options?.force && !TRANSITIONS[current.status].includes(to)) {
    throw new DomainError(
      `No se puede pasar de ${current.status} a ${to}. Desde ${current.status} solo se puede ir a: ${TRANSITIONS[current.status].join(', ') || '(ningún estado: es terminal)'}.`,
      409,
    );
  }

  // La validación se corre al SALIR del borrador, que es el último momento en
  // que corregir es barato. Después ya hay un vault desplegado.
  if (to === 'SUBMITTED') {
    const issues = validateDossier(current);
    if (hasBlockingIssues(issues)) {
      throw new DomainError('El dossier tiene errores que impiden presentarlo.', 422, issues.filter((i) => i.severity === 'ERROR'));
    }
  }

  const timestamp = now();
  const next = { ...current, status: to, updatedAt: timestamp, publishedAt: to === 'PUBLISHED' ? timestamp : current.publishedAt };
  db().prepare('UPDATE projects SET status=?, dossier=?, updated_at=?, published_at=? WHERE id=?')
    .run(to, JSON.stringify(next), timestamp, next.publishedAt, current.id);
  return next;
}

/**
 * Estados cuyo dueño es la cadena. Una vez que el vault llegó a cualquiera de
 * ellos, lo que diga la base sobre estados anteriores es historia.
 */
const CHAIN_OWNED: ProjectStatus[] = ['FUNDING', 'ACTIVE', 'COMPLETED', 'ROUND_FAILED', 'MILESTONE_FAILED'];

/**
 * Marca el dossier como PUBLISHED después de crearlo en cadena.
 *
 * Existe en vez de un `transition(id, 'PUBLISHED')` pelado por una carrera real:
 * el indexador corre cada 4 s, y entre que `createProject` se confirma y el
 * llamador vuelve, puede haber visto ya el evento, leído `projects()` en el
 * vault y movido el estado a FUNDING.
 *
 * Cuando eso pasa, PUBLISHED es un estado que la cadena YA superó, y forzarlo
 * sería retroceder. Se acepta que ganó la cadena — es la regla de toda la capa
 * de indexado— en vez de reventar con un 409 que además dejaría el dossier sin
 * su dirección de vault.
 */
export function markPublished(id: string): ProjectDossier {
  const current = getProject(id);
  if (!current) throw new DomainError('Proyecto inexistente', 404);
  if (CHAIN_OWNED.includes(current.status)) return current;
  return transition(id, 'PUBLISHED');
}

/**
 * Reasigna el id on-chain de un proyecto que TODAVÍA no se publicó.
 *
 * Hace falta porque la base y la cadena tienen espacios de ids independientes:
 * `--reset` limpia la primera y no puede limpiar la segunda. Después de
 * publicar sería impensable — el id ya está grabado en el vault—, y por eso se
 * rechaza.
 */
export function reassignOnChainId(id: string, onChainId: number): ProjectDossier {
  const current = getProject(id);
  if (!current) throw new DomainError('Proyecto inexistente', 404);
  if (current.vaultAddress) {
    throw new DomainError('El proyecto ya está en cadena: su id no se puede cambiar.', 409);
  }
  const next = { ...current, onChainId, updatedAt: now() };
  db().prepare('UPDATE projects SET on_chain_id=?, dossier=?, updated_at=? WHERE id=?')
    .run(onChainId, JSON.stringify(next), next.updatedAt, current.id);
  return next;
}

export function addReviewNote(projectId: string, author: string, decision: string, body: string) {
  const id = randomUUID();
  db().prepare('INSERT INTO review_notes (id, project_id, author, decision, body, created_at) VALUES (?,?,?,?,?,?)')
    .run(id, projectId, author, decision, body, now());
  return { id, projectId, author, decision, body, createdAt: now() };
}

export function reviewNotes(projectId: string) {
  return db().prepare('SELECT * FROM review_notes WHERE project_id = ? ORDER BY created_at').all(projectId);
}

// ------------------------------------------------------------------ evidencia

export function addEvidence(e: Omit<Evidence, 'id' | 'uploadedAt'> & { content?: Buffer }): Evidence {
  const project = getProject(e.projectId);
  if (!project) throw new DomainError('Proyecto inexistente', 404);
  if (e.milestoneIndex < 0 || e.milestoneIndex >= project.milestones.length) {
    throw new DomainError(`El proyecto tiene ${project.milestones.length} hitos; no existe el índice ${e.milestoneIndex}.`, 400);
  }

  // El hash se calcula acá sobre los bytes recibidos y no se acepta del cliente.
  // Aceptarlo sería dejar que quien sube la evidencia elija qué se firma.
  const sha256 = e.content
    ? `0x${createHash('sha256').update(e.content).digest('hex')}`
    : e.sha256;
  if (!/^0x[0-9a-f]{64}$/i.test(sha256)) throw new DomainError('El hash de la evidencia no es un sha256 válido.', 400);

  const record: Evidence = {
    ...e, id: randomUUID(), sha256, uploadedAt: now(),
  };

  db().prepare(
    `INSERT INTO evidence (id, project_id, milestone_index, kind, filename, content_type, size_bytes, sha256, ipfs_cid, uploaded_by, uploaded_at, notes)
     VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`,
  ).run(record.id, record.projectId, record.milestoneIndex, record.kind, record.filename,
        record.contentType, record.sizeBytes, record.sha256, record.ipfsCid, record.uploadedBy,
        record.uploadedAt, record.notes);

  return record;
}

export function listEvidence(projectId: string, milestoneIndex?: number): Evidence[] {
  const rows = milestoneIndex === undefined
    ? db().prepare('SELECT * FROM evidence WHERE project_id = ? ORDER BY milestone_index, uploaded_at').all(projectId)
    : db().prepare('SELECT * FROM evidence WHERE project_id = ? AND milestone_index = ? ORDER BY uploaded_at').all(projectId, milestoneIndex);

  return (rows as unknown as Record<string, never>[]).map((r) => ({
    id: r.id, projectId: r.project_id, milestoneIndex: r.milestone_index, kind: r.kind,
    filename: r.filename, contentType: r.content_type, sizeBytes: r.size_bytes,
    sha256: r.sha256, ipfsCid: r.ipfs_cid, uploadedBy: r.uploaded_by,
    uploadedAt: r.uploaded_at, notes: r.notes,
  })) as unknown as Evidence[];
}

/**
 * Hash del PAQUETE de evidencia de un hito: lo que el verificador firma.
 *
 * Se construye ordenando los sha256 individuales y hasheando la concatenación.
 * El orden es lo que lo hace determinista —dos personas armando el paquete
 * llegan al mismo hash— y agregar o quitar UN archivo lo cambia entero. Eso es
 * lo que impide que alguien firme un hito y después cambie qué había adentro.
 */
export function evidenceBundleHash(projectId: string, milestoneIndex: number): string {
  const hashes = listEvidence(projectId, milestoneIndex).map((e) => e.sha256.toLowerCase()).sort();
  if (hashes.length === 0) {
    throw new DomainError(
      `El hito ${milestoneIndex} no tiene evidencia cargada. Firmar un hito sin evidencia deja una acreditación que después nadie puede contrastar contra nada.`,
      409,
    );
  }
  const h = createHash('sha256');
  for (const hash of hashes) h.update(Buffer.from(hash.slice(2), 'hex'));
  return `0x${h.digest('hex')}`;
}
