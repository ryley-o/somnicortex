import Database from "better-sqlite3";
import path from "node:path";
import { ensureDir } from "./fs.js";

export async function openSqliteWithPragmas(dbPath: string): Promise<Database.Database> {
  await ensureDir(path.dirname(dbPath));
  const db = new Database(dbPath);
  // Explicit PRAGMAs required by the PRD for concurrency and consistency.
  db.pragma("journal_mode = WAL");
  db.pragma("synchronous = NORMAL");
  db.pragma("foreign_keys = ON");
  db.pragma("cache_size = -64000");
  db.pragma("temp_store = MEMORY");
  return db;
}

export function migrateEpisodic(db: Database.Database): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS episodes (
      id TEXT PRIMARY KEY,
      created_at TEXT NOT NULL,
      task_id TEXT,
      content TEXT NOT NULL,
      salience REAL NOT NULL DEFAULT 0.0,
      citation_rate REAL NOT NULL DEFAULT 0.0
    );
    CREATE VIRTUAL TABLE IF NOT EXISTS episodes_fts USING fts5(
      id, content, tokenize='unicode61'
    );
  `);
}

export function migrateSemantic(db: Database.Database): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS nodes (
      id TEXT PRIMARY KEY,
      kind TEXT NOT NULL,
      label TEXT NOT NULL,
      pending_review INTEGER NOT NULL DEFAULT 0,
      activation REAL NOT NULL DEFAULT 1.0
    );
    CREATE TABLE IF NOT EXISTS edges (
      id TEXT PRIMARY KEY,
      source_id TEXT NOT NULL,
      target_id TEXT NOT NULL,
      relation TEXT NOT NULL,
      confidence REAL NOT NULL DEFAULT 0.0,
      FOREIGN KEY(source_id) REFERENCES nodes(id),
      FOREIGN KEY(target_id) REFERENCES nodes(id)
    );
    CREATE TABLE IF NOT EXISTS node_embeddings (
      node_id TEXT PRIMARY KEY,
      embedding_json TEXT NOT NULL,
      FOREIGN KEY(node_id) REFERENCES nodes(id)
    );
  `);
}

export function migrateProcedural(db: Database.Database): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS skills (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      body TEXT NOT NULL,
      citation_rate REAL NOT NULL DEFAULT 0.0,
      updated_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS policies (
      id TEXT PRIMARY KEY,
      scope TEXT NOT NULL,
      body TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
  `);
}

export function migrateProspective(db: Database.Database): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS intentions (
      id TEXT PRIMARY KEY,
      status TEXT NOT NULL,
      title TEXT NOT NULL,
      linked_memory_ids_json TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
  `);
}
