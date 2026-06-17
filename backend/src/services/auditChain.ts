import { createHash } from "crypto";
import { getDb } from "../db/database.js";
import { v4 as uuidv4 } from "uuid";

export function sha256(data: string): string {
  return createHash("sha256").update(data).digest("hex");
}

export function hashFile(buffer: Buffer): string {
  return createHash("sha256").update(buffer).digest("hex");
}

export function getLastChainHash(projectId: string): string {
  const db = getDb();
  const last = db
    .prepare(
      "SELECT chain_hash FROM audit_log WHERE project_id = ? ORDER BY sequence DESC LIMIT 1"
    )
    .get(projectId) as { chain_hash: string } | undefined;
  return (
    last?.chain_hash ??
    "0000000000000000000000000000000000000000000000000000000000000000"
  );
}

export function getLastSequence(projectId: string): number {
  const db = getDb();
  const last = db
    .prepare(
      "SELECT sequence FROM audit_log WHERE project_id = ? ORDER BY sequence DESC LIMIT 1"
    )
    .get(projectId) as { sequence: number } | undefined;
  return last?.sequence ?? 0;
}

export function appendAuditEntry(entry: {
  event_type: string;
  team_id: string;
  project_id: string;
  submission_id?: string;
  interpretation_id?: string;
  data: Record<string, unknown>;
}): string {
  const db = getDb();
  const previousHash = getLastChainHash(entry.project_id);
  const sequence = getLastSequence(entry.project_id) + 1;
  const timestamp = new Date().toISOString();
  const id = uuidv4();

  const payload = JSON.stringify({
    id,
    sequence,
    event_type: entry.event_type,
    team_id: entry.team_id,
    project_id: entry.project_id,
    submission_id: entry.submission_id ?? null,
    interpretation_id: entry.interpretation_id ?? null,
    data: entry.data,
    timestamp,
  });

  const payloadHash = sha256(payload);
  const chainHash = sha256(payloadHash + previousHash);

  db.prepare(`
    INSERT INTO audit_log (
      id, sequence, event_type, team_id, project_id,
      submission_id, interpretation_id, payload,
      payload_hash, previous_entry_hash, chain_hash, timestamp
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    id,
    sequence,
    entry.event_type,
    entry.team_id,
    entry.project_id,
    entry.submission_id ?? null,
    entry.interpretation_id ?? null,
    payload,
    payloadHash,
    previousHash,
    chainHash,
    timestamp
  );

  return chainHash;
}

export function verifyChain(projectId: string): {
  valid: boolean;
  totalEntries: number;
  firstBrokenAt?: number;
  entries: Array<{ sequence: number; valid: boolean; chain_hash: string }>;
} {
  const db = getDb();
  const entries = db
    .prepare(
      "SELECT * FROM audit_log WHERE project_id = ? ORDER BY sequence ASC"
    )
    .all(projectId) as Array<{
    id: string;
    sequence: number;
    payload: string;
    payload_hash: string;
    previous_entry_hash: string;
    chain_hash: string;
  }>;

  const GENESIS =
    "0000000000000000000000000000000000000000000000000000000000000000";
  let previousHash = GENESIS;
  let valid = true;
  let firstBrokenAt: number | undefined;
  const results = [];

  for (const entry of entries) {
    const recomputedPayloadHash = sha256(entry.payload);
    const recomputedChainHash = sha256(recomputedPayloadHash + previousHash);
    const entryValid =
      recomputedPayloadHash === entry.payload_hash &&
      recomputedChainHash === entry.chain_hash;

    if (!entryValid && valid) {
      valid = false;
      firstBrokenAt = entry.sequence;
    }

    results.push({
      sequence: entry.sequence,
      valid: entryValid,
      chain_hash: entry.chain_hash,
    });
    previousHash = entry.chain_hash;
  }

  return { valid, totalEntries: entries.length, firstBrokenAt, entries: results };
}
