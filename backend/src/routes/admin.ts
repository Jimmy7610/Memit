import express from "express";
import { getDb } from "../db/database.js";
import { v4 as uuidv4 } from "uuid";

const router = express.Router();

// Simple admin auth middleware
function adminAuth(
  req: express.Request,
  res: express.Response,
  next: express.NextFunction
): void {
  const code = req.headers["x-admin-code"] as string;
  if (code !== (process.env.ADMIN_CODE ?? "ADMIN2024")) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  next();
}

// POST /api/admin/teams — create a team
router.post("/teams", adminAuth, (req, res) => {
  const { name, access_code } = req.body as {
    name: string;
    access_code: string;
  };
  if (!name || !access_code) {
    res.status(400).json({ error: "name and access_code required" });
    return;
  }
  const db = getDb();
  const id = uuidv4();
  const now = new Date().toISOString();

  // Also create a project for this team
  const projectId = uuidv4();

  try {
    db.prepare(
      "INSERT INTO teams (id, name, access_code, is_admin, created_at) VALUES (?, ?, ?, 0, ?)"
    ).run(id, name, access_code, now);
    db.prepare(
      "INSERT INTO projects (id, team_id, title, description, status, created_at, updated_at) VALUES (?, ?, ?, ?, 'active', ?, ?)"
    ).run(projectId, id, `${name}'s Project`, "", now, now);
    res.json({
      team: { id, name, access_code },
      project: { id: projectId },
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    if (message?.includes("UNIQUE")) {
      res.status(409).json({ error: "Access code already in use" });
    } else {
      res.status(500).json({ error: "Failed to create team" });
    }
  }
});

// GET /api/admin/teams — list all teams
router.get("/teams", adminAuth, (req, res) => {
  const db = getDb();
  const teams = db
    .prepare(
      `
    SELECT t.*, p.id as project_id, p.title as project_title, p.status as project_status,
    (SELECT COUNT(*) FROM meme_submissions WHERE project_id = p.id) as meme_count
    FROM teams t
    LEFT JOIN projects p ON p.team_id = t.id
    WHERE t.is_admin = 0
    ORDER BY t.created_at ASC
  `
    )
    .all();
  res.json(teams);
});

// GET /api/admin/all-submissions — all submissions
router.get("/all-submissions", adminAuth, (req, res) => {
  const db = getDb();
  const submissions = db
    .prepare(
      `
    SELECT s.*, t.name as team_name, p.title as project_title
    FROM meme_submissions s
    JOIN teams t ON t.id = s.team_id
    JOIN projects p ON p.id = s.project_id
    ORDER BY s.submitted_at DESC
  `
    )
    .all();
  res.json(submissions);
});

// POST /api/admin/interpret/:submissionId — manually set interpretation
router.post("/interpret/:submissionId", adminAuth, (req, res) => {
  const { submissionId } = req.params;
  const { meme_identified_as, interpretation, proposed_action, confidence_level } =
    req.body as {
      meme_identified_as: string;
      interpretation: string;
      proposed_action: string;
      confidence_level: "high" | "medium" | "low";
    };

  const db = getDb();
  const submission = db
    .prepare("SELECT * FROM meme_submissions WHERE id = ?")
    .get(submissionId);
  if (!submission) {
    res.status(404).json({ error: "Submission not found" });
    return;
  }

  // Check if interpretation already exists
  const existing = db
    .prepare("SELECT id FROM claude_interpretations WHERE submission_id = ?")
    .get(submissionId);
  const id = uuidv4();
  const now = new Date().toISOString();

  if (existing) {
    db.prepare(`
      UPDATE claude_interpretations
      SET meme_identified_as = ?, interpretation = ?, proposed_action = ?, confidence_level = ?, model_used = 'manual'
      WHERE submission_id = ?
    `).run(
      meme_identified_as,
      interpretation,
      proposed_action,
      confidence_level,
      submissionId
    );
  } else {
    db.prepare(`
      INSERT INTO claude_interpretations (id, submission_id, meme_identified_as, interpretation, proposed_action, confidence_level, created_at, model_used)
      VALUES (?, ?, ?, ?, ?, ?, ?, 'manual')
    `).run(
      id,
      submissionId,
      meme_identified_as,
      interpretation,
      proposed_action,
      confidence_level,
      now
    );
  }

  res.json({ success: true });
});

// POST /api/admin/login
router.post("/login", (req, res) => {
  const { code } = req.body as { code: string };
  if (code === (process.env.ADMIN_CODE ?? "ADMIN2024")) {
    res.json({ success: true, role: "admin" });
  } else {
    res.status(401).json({ error: "Invalid code" });
  }
});

export default router;
