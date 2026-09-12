// ---------------------------------------------------------------------------
//  Persistencia — SQLite
// ---------------------------------------------------------------------------
//
//  `node:sqlite` viene en el runtime: cero dependencias nativas que compilar y
//  cero servidor que levantar. Para el volumen de una plataforma de project
//  finance —decenas de proyectos, miles de inversionistas— sobra, y el día que
//  no alcance, el esquema es SQL plano y se migra a Postgres sin reescribir la
//  aplicación.
//
//  Dos decisiones de esquema que vale la pena justificar:
//
//  1. LOS MONTOS SON TEXT, NO INTEGER. SQLite guarda enteros de 64 bits con
//     signo: 9,22e18 como máximo. Un capital de 9 cifras con 6 decimales
//     todavía entra, pero los acumulados de repago de una cartera entera no
//     necesariamente, y el día que se desborde nadie se entera: SQLite lo pasa
//     silenciosamente a float. TEXT + BigInt no tiene techo ni pierde un
//     centavo.
//
//  2. EL DOSSIER VA COMO JSON EN UNA COLUMNA. Es un documento anidado que se
//     lee entero o no se lee; normalizarlo en quince tablas para volver a
//     unirlas en cada lectura no compra nada. Lo que SÍ está normalizado es
//     todo lo que se consulta, se filtra o se audita por separado: evidencias,
//     attestations, credenciales, eventos de cadena.

import { DatabaseSync } from 'node:sqlite';
import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { config } from './config.ts';

export const SCHEMA = `
CREATE TABLE IF NOT EXISTS projects (
  id            TEXT PRIMARY KEY,
  on_chain_id   INTEGER UNIQUE NOT NULL,
  name          TEXT NOT NULL,
  status        TEXT NOT NULL,
  developer_id  TEXT NOT NULL,
  city          TEXT NOT NULL,
  -- El dossier completo. Ver nota 2 arriba.
  dossier       TEXT NOT NULL,
  created_at    TEXT NOT NULL,
  updated_at    TEXT NOT NULL,
  published_at  TEXT
);

CREATE TABLE IF NOT EXISTS review_notes (
  id          TEXT PRIMARY KEY,
  project_id  TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  author      TEXT NOT NULL,
  decision    TEXT NOT NULL,  -- SUBMITTED | CHANGES_REQUESTED | APPROVED | REJECTED
  body        TEXT NOT NULL,
  created_at  TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS evidence (
  id              TEXT PRIMARY KEY,
  project_id      TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  milestone_index INTEGER NOT NULL,
  kind            TEXT NOT NULL,
  filename        TEXT NOT NULL,
  content_type    TEXT NOT NULL,
  size_bytes      INTEGER NOT NULL,
  sha256          TEXT NOT NULL,
  ipfs_cid        TEXT,
  uploaded_by     TEXT NOT NULL,
  uploaded_at     TEXT NOT NULL,
  notes           TEXT NOT NULL DEFAULT ''
);
CREATE INDEX IF NOT EXISTS idx_evidence_milestone ON evidence(project_id, milestone_index);

CREATE TABLE IF NOT EXISTS attestations (
  digest          TEXT PRIMARY KEY,
  project_id      TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  milestone_index INTEGER NOT NULL,
  evidence_hash   TEXT NOT NULL,
  approved        INTEGER NOT NULL,
  nonce           TEXT NOT NULL,
  expires_at      INTEGER NOT NULL,
  signature       TEXT NOT NULL,
  signer          TEXT NOT NULL,
  signed_at       TEXT NOT NULL,
  -- NULL hasta que alguien la manda a la cadena. Firmar y liberar son dos
  -- actos distintos: el verificador firma, cualquiera puede transmitirla.
  submitted_tx    TEXT
);
CREATE INDEX IF NOT EXISTS idx_attestations_project ON attestations(project_id, milestone_index);

CREATE TABLE IF NOT EXISTS investors (
  id            TEXT PRIMARY KEY,
  address       TEXT UNIQUE NOT NULL,
  display_name  TEXT NOT NULL,
  email         TEXT NOT NULL,
  -- Tamizaje AML del operador. Es lo que la plataforma AFIRMA.
  kyc_status    TEXT NOT NULL DEFAULT 'PENDING',
  kyc_synced_at TEXT,
  created_at    TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS credentials (
  id            TEXT PRIMARY KEY,
  investor_id   TEXT NOT NULL REFERENCES investors(id) ON DELETE CASCADE,
  leaf_index    INTEGER NOT NULL,
  -- SOLO la hoja. El secreto, el patrimonio y la jurisdicción se le entregan
  -- una vez al titular y el servidor no los guarda: lo que no está no se filtra.
  leaf          TEXT NOT NULL,
  issued_at     TEXT NOT NULL,
  expires_at    INTEGER NOT NULL,
  revoked_at    TEXT
);

CREATE TABLE IF NOT EXISTS issuer_state (
  id         INTEGER PRIMARY KEY CHECK (id = 1),
  root       TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS chain_events (
  id          TEXT PRIMARY KEY,
  project_id  TEXT,
  on_chain_id INTEGER,
  kind        TEXT NOT NULL,
  block_number INTEGER NOT NULL,
  tx_hash     TEXT NOT NULL,
  log_index   INTEGER NOT NULL,
  payload     TEXT NOT NULL,
  observed_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_events_project ON chain_events(on_chain_id, block_number);

CREATE TABLE IF NOT EXISTS sync_cursor (
  id           INTEGER PRIMARY KEY CHECK (id = 1),
  last_block   INTEGER NOT NULL
);
`;

let database: DatabaseSync | null = null;

export function db(): DatabaseSync {
  if (!database) {
    mkdirSync(dirname(config.dbPath), { recursive: true });
    database = new DatabaseSync(config.dbPath);
    // WAL: lecturas concurrentes sin bloquear al escritor. El indexador de
    // eventos escribe mientras la API lee, y sin esto se pisan.
    database.exec('PRAGMA journal_mode = WAL');
    database.exec('PRAGMA foreign_keys = ON');
    database.exec(SCHEMA);
  }
  return database;
}

export function resetDb(): void {
  const d = db();
  for (const table of [
    'chain_events', 'sync_cursor', 'credentials', 'issuer_state',
    'attestations', 'evidence', 'review_notes', 'investors', 'projects',
  ]) {
    d.exec(`DELETE FROM ${table}`);
  }
}

export function now(): string {
  return new Date().toISOString();
}
