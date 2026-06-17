import express from "express";
import { getDb } from "../db/database.js";

const router = express.Router();

// POST /api/team/login
router.post("/login", (req, res) => {
  const { access_code } = req.body as { access_code: string };
  if (!access_code) {
    res.status(400).json({ error: "access_code required" });
    return;
  }

  const db = getDb();
  const team = db
    .prepare("SELECT * FROM teams WHERE access_code = ? AND is_admin = 0")
    .get(access_code) as
    | { id: string; name: string; access_code: string }
    | undefined;

  if (!team) {
    res.status(401).json({ error: "Invalid access code" });
    return;
  }

  const project = db
    .prepare("SELECT * FROM projects WHERE team_id = ?")
    .get(team.id) as
    | { id: string; title: string; status: string }
    | undefined;

  res.json({
    team: { id: team.id, name: team.name },
    project: project
      ? { id: project.id, title: project.title, status: project.status }
      : null,
  });
});

export default router;
