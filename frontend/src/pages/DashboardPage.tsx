import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext.tsx";
import styles from "./DashboardPage.module.css";

interface Submission {
  id: string;
  sequence_number: number;
  stored_filename: string;
  submitted_at: string;
  meme_identified_as?: string;
  interpretation?: string;
  proposed_action?: string;
  confidence_level?: string;
}

export default function DashboardPage() {
  const { session } = useAuth();
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!session?.projectId) return;
    fetch(`/api/meme/${session.projectId}`)
      .then((r) => r.json())
      .then((data: Submission[]) => { setSubmissions(data); setLoading(false); })
      .catch(() => setLoading(false));
  }, [session?.projectId]);

  const latest = submissions[submissions.length - 1];

  return (
    <div className={styles.page}>
      <div className={styles.hero}>
        <h1 className={styles.teamName}>{session?.teamName}</h1>
        <p className={styles.projectTitle}>{session?.projectTitle ?? "Your Project"}</p>
        <div className={styles.stats}>
          <div className={styles.stat}>
            <span className={styles.statNum}>{submissions.length}</span>
            <span className={styles.statLabel}>Memes submitted</span>
          </div>
          <div className={styles.stat}>
            <span className={styles.statNum}>{submissions.filter(s => s.meme_identified_as).length}</span>
            <span className={styles.statLabel}>Interpreted</span>
          </div>
        </div>
        <Link to="/upload" className={styles.ctaButton}>
          + Submit Next Meme
        </Link>
      </div>

      {latest && latest.meme_identified_as && (
        <div className={styles.latestCard}>
          <div className={styles.latestLabel}>Latest interpretation</div>
          <div className={styles.memeRow}>
            <img
              src={`/uploads/${latest.stored_filename}`}
              alt="Latest meme"
              className={styles.memeThumb}
            />
            <div>
              <div className={styles.memeName}>{latest.meme_identified_as}</div>
              <p className={styles.interpretation}>{latest.interpretation}</p>
            </div>
          </div>
          <div className={styles.actionBox}>
            <span className={styles.actionLabel}>Proposed action</span>
            <p className={styles.action}>{latest.proposed_action}</p>
          </div>
        </div>
      )}

      {!loading && submissions.length === 0 && (
        <div className={styles.empty}>
          <div className={styles.emptyIcon}>🖼️</div>
          <h2>No memes yet</h2>
          <p>Submit your first meme to get started. No text — just memes.</p>
          <Link to="/upload" className={styles.ctaButton}>Submit First Meme</Link>
        </div>
      )}
    </div>
  );
}
