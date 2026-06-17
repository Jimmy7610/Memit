import express from "express";
import { getDb } from "../db/database.js";
import { verifyChain } from "../services/auditChain.js";

const router = express.Router();

// GET /api/audit/:projectId — get audit log
router.get("/:projectId", (req, res) => {
  const { projectId } = req.params;
  const db = getDb();

  const entries = db
    .prepare(
      "SELECT * FROM audit_log WHERE project_id = ? ORDER BY sequence ASC"
    )
    .all(projectId);

  const parsed = (entries as Record<string, unknown>[]).map((e) => ({
    ...e,
    data: JSON.parse(e.payload as string),
  }));

  res.json(parsed);
});

// GET /api/audit/:projectId/verify — verify chain integrity
router.get("/:projectId/verify", (req, res) => {
  const { projectId } = req.params;
  const result = verifyChain(projectId);
  res.json(result);
});

// GET /api/audit/:projectId/export — export as JSON
router.get("/:projectId/export", (req, res) => {
  const { projectId } = req.params;
  const db = getDb();

  const project = db
    .prepare("SELECT * FROM projects WHERE id = ?")
    .get(projectId) as Record<string, unknown> | undefined;
  const team =
    project
      ? (db
          .prepare("SELECT * FROM teams WHERE id = ?")
          .get(project.team_id as string) as Record<string, unknown> | undefined)
      : undefined;
  const entries = db
    .prepare(
      "SELECT * FROM audit_log WHERE project_id = ? ORDER BY sequence ASC"
    )
    .all(projectId) as Record<string, unknown>[];
  const verification = verifyChain(projectId);

  const exportData = {
    export_timestamp: new Date().toISOString(),
    project,
    team: team ? { id: team.id, name: team.name } : null,
    verification_result: verification,
    audit_log: entries.map((e) => ({
      ...e,
      parsed_payload: JSON.parse(e.payload as string),
    })),
  };

  res.setHeader("Content-Type", "application/json");
  res.setHeader(
    "Content-Disposition",
    `attachment; filename="memit-audit-${projectId}-${Date.now()}.json"`
  );
  res.json(exportData);
});

export default router;
