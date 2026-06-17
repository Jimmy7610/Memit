import Database from "better-sqlite3";
import path from "path";
import { fileURLToPath } from "url";
import { v4 as uuidv4 } from "uuid";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DB_PATH = path.join(__dirname, "..", "..", "memit.db");

let db: Database.Database;

export function getDb(): Database.Database {
  if (!db) {
    db = new Database(DB_PATH);
    db.pragma("journal_mode = WAL");
  }
  return db;
}

export function initDb(): void {
  const database = getDb();

  database.exec(`
    CREATE TABLE IF NOT EXISTS teams (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      access_code TEXT NOT NULL UNIQUE,
      is_admin INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS projects (
      id TEXT PRIMARY KEY,
      team_id TEXT NOT NULL,
      title TEXT NOT NULL DEFAULT 'Untitled Project',
      description TEXT,
      status TEXT NOT NULL DEFAULT 'active',
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      FOREIGN KEY (team_id) REFERENCES teams(id)
    );

    CREATE TABLE IF NOT EXISTS meme_submissions (
      id TEXT PRIMARY KEY,
      project_id TEXT NOT NULL,
      team_id TEXT NOT NULL,
      sequence_number INTEGER NOT NULL,
      stored_filename TEXT NOT NULL,
      original_format TEXT NOT NULL,
      file_size_bytes INTEGER NOT NULL,
      sha256_hash TEXT NOT NULL,
      submitted_at TEXT NOT NULL,
      is_valid INTEGER NOT NULL DEFAULT 1,
      rejection_reason TEXT,
      FOREIGN KEY (project_id) REFERENCES projects(id),
      FOREIGN KEY (team_id) REFERENCES teams(id)
    );

    CREATE TABLE IF NOT EXISTS claude_interpretations (
      id TEXT PRIMARY KEY,
      submission_id TEXT NOT NULL UNIQUE,
      meme_identified_as TEXT NOT NULL,
      interpretation TEXT NOT NULL,
      proposed_action TEXT NOT NULL,
      confidence_level TEXT NOT NULL DEFAULT 'medium',
      created_at TEXT NOT NULL,
      model_used TEXT NOT NULL DEFAULT 'manual',
      FOREIGN KEY (submission_id) REFERENCES meme_submissions(id)
    );

    CREATE TABLE IF NOT EXISTS audit_log (
      id TEXT PRIMARY KEY,
      sequence INTEGER NOT NULL,
      event_type TEXT NOT NULL,
      team_id TEXT NOT NULL,
      project_id TEXT NOT NULL,
      submission_id TEXT,
      interpretation_id TEXT,
      payload TEXT NOT NULL,
      payload_hash TEXT NOT NULL,
      previous_entry_hash TEXT NOT NULL,
      chain_hash TEXT NOT NULL,
      timestamp TEXT NOT NULL
    );
  `);

  // Seed admin team
  const existing = database
    .prepare("SELECT id FROM teams WHERE access_code = ?")
    .get("ADMIN2024");
  if (!existing) {
    database
      .prepare(
        `INSERT INTO teams (id, name, access_code, is_admin, created_at) VALUES (?, ?, ?, ?, ?)`
      )
      .run(uuidv4(), "Arrangers", "ADMIN2024", 1, new Date().toISOString());
  }

  console.log("Database initialized");
}
