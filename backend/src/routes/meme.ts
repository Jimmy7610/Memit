import express from "express";
import multer from "multer";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";
import { v4 as uuidv4 } from "uuid";
import { getDb } from "../db/database.js";
import { hashFile, appendAuditEntry } from "../services/auditChain.js";
import {
  validateMemeFile,
  getExtensionFromMime,
} from "../services/memeValidator.js";
import { interpretMeme } from "../services/claudeClient.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const router = express.Router();

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    const dir = path.join(__dirname, "..", "..", "uploads");
    cb(null, dir);
  },
  filename: (_req, _file, cb) => {
    // Temporary name; will rename after sequence number is known
    cb(null, `tmp_${uuidv4()}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const result = validateMemeFile(file.mimetype, 0);
    if (!result.valid && result.reason?.includes("type")) {
      cb(new Error(result.reason));
    } else {
      cb(null, true);
    }
  },
});

// POST /api/meme — submit a meme
router.post("/", upload.single("meme"), async (req, res) => {
  try {
    const file = req.file;
    const { team_id, project_id } = req.body as {
      team_id: string;
      project_id: string;
    };

    if (!file) {
      res.status(400).json({ error: "No file uploaded" });
      return;
    }
    if (!team_id || !project_id) {
      fs.unlinkSync(file.path);
      res.status(400).json({ error: "team_id and project_id are required" });
      return;
    }

    const db = getDb();

    // Validate team and project exist
    const team = db.prepare("SELECT id FROM teams WHERE id = ?").get(team_id);
    if (!team) {
      fs.unlinkSync(file.path);
      res.status(404).json({ error: "Team not found" });
      return;
    }

    const project = db
      .prepare("SELECT id FROM projects WHERE id = ? AND team_id = ?")
      .get(project_id, team_id);
    if (!project) {
      fs.unlinkSync(file.path);
      res.status(404).json({ error: "Project not found" });
      return;
    }

    // Validate file
    const validation = validateMemeFile(file.mimetype, file.size);
    if (!validation.valid) {
      fs.unlinkSync(file.path);
      res.status(400).json({ error: validation.reason });
      return;
    }

    // Get sequence number
    const seqRow = db
      .prepare(
        "SELECT COUNT(*) as cnt FROM meme_submissions WHERE project_id = ?"
      )
      .get(project_id) as { cnt: number };
    const sequenceNumber = seqRow.cnt + 1;

    // Rename file to meme_NNN.ext
    const ext = getExtensionFromMime(file.mimetype);
    const storedFilename = `meme_${String(sequenceNumber).padStart(3, "0")}_${project_id.slice(0, 8)}.${ext}`;
    const uploadsDir = path.join(__dirname, "..", "..", "uploads");
    const newPath = path.join(uploadsDir, storedFilename);
    fs.renameSync(file.path, newPath);

    // Hash the file
    const fileBuffer = fs.readFileSync(newPath);
    const sha256Hash = hashFile(fileBuffer);

    // Insert submission
    const submissionId = uuidv4();
    db.prepare(`
      INSERT INTO meme_submissions (
        id, project_id, team_id, sequence_number, stored_filename,
        original_format, file_size_bytes, sha256_hash, submitted_at, is_valid
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      submissionId,
      project_id,
      team_id,
      sequenceNumber,
      storedFilename,
      ext,
      file.size,
      sha256Hash,
      new Date().toISOString(),
      1
    );

    // Update project timestamp
    db.prepare("UPDATE projects SET updated_at = ? WHERE id = ?").run(
      new Date().toISOString(),
      project_id
    );

    // Append audit entry for submission
    appendAuditEntry({
      event_type: "meme_submitted",
      team_id,
      project_id,
      submission_id: submissionId,
      data: {
        stored_filename: storedFilename,
        sha256_hash: sha256Hash,
        sequence_number: sequenceNumber,
        file_size_bytes: file.size,
      },
    });

    // Interpret the meme via Claude
    let interpretationId: string | null = null;
    try {
      const interpretation = await interpretMeme(newPath, file.mimetype);
      interpretationId = uuidv4();

      db.prepare(`
        INSERT INTO claude_interpretations (
          id, submission_id, meme_identified_as, interpretation,
          proposed_action, confidence_level, created_at, model_used
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        interpretationId,
        submissionId,
        interpretation.meme_identified_as,
        interpretation.interpretation,
        interpretation.proposed_action,
        interpretation.confidence_level,
        new Date().toISOString(),
        process.env.ANTHROPIC_API_KEY ? "claude-sonnet-4-6" : "manual"
      );

      // Append audit entry for interpretation
      appendAuditEntry({
        event_type: "interpreted",
        team_id,
        project_id,
        submission_id: submissionId,
        interpretation_id: interpretationId,
        data: {
          meme_identified_as: interpretation.meme_identified_as,
          interpretation: interpretation.interpretation,
          proposed_action: interpretation.proposed_action,
          confidence_level: interpretation.confidence_level,
        },
      });

      res.json({
        submission_id: submissionId,
        sequence_number: sequenceNumber,
        stored_filename: storedFilename,
        sha256_hash: sha256Hash,
        interpretation: {
          id: interpretationId,
          ...interpretation,
        },
      });
    } catch (_err) {
      // Return submission even if interpretation fails
      res.json({
        submission_id: submissionId,
        sequence_number: sequenceNumber,
        stored_filename: storedFilename,
        sha256_hash: sha256Hash,
        interpretation: null,
        interpretation_error:
          "Failed to interpret meme. Try again or contact admin.",
      });
    }
  } catch (err) {
    console.error("Meme upload error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// GET /api/meme/:projectId — list all submissions for a project
router.get("/:projectId", (req, res) => {
  const { projectId } = req.params;
  const db = getDb();

  const submissions = db
    .prepare(
      `
    SELECT
      s.*,
      i.meme_identified_as,
      i.interpretation,
      i.proposed_action,
      i.confidence_level,
      i.model_used,
      i.id as interpretation_id
    FROM meme_submissions s
    LEFT JOIN claude_interpretations i ON i.submission_id = s.id
    WHERE s.project_id = ?
    ORDER BY s.sequence_number ASC
  `
    )
    .all(projectId);

  res.json(submissions);
});

export default router;
