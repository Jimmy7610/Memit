import { useEffect, useState } from "react";
import { useAuth } from "../context/AuthContext.tsx";
import styles from "./HistoryPage.module.css";

interface Submission {
  id: string;
  sequence_number: number;
  stored_filename: string;
  submitted_at: string;
  sha256_hash: string;
  meme_identified_as?: string;
  interpretation?: string;
  proposed_action?: string;
  confidence_level?: string;
}

export default function HistoryPage() {
  const { session } = useAuth();
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!session?.projectId) return;
    fetch(`/api/meme/${session.projectId}`)
      .then((r) => r.json())
      .then((data: Submission[]) => {
        setSubmissions(data);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [session?.projectId]);

  if (loading) return <div className={styles.loading}>Loading...</div>;

  return (
    <div className={styles.page}>
      <h1 className={styles.title}>Meme History</h1>
      <p className={styles.subtitle}>{submissions.length} memes submitted</p>

      <div className={styles.timeline}>
        {submissions.map((s) => (
          <div key={s.id} className={styles.entry}>
            <div className={styles.seqNum}>#{s.sequence_number}</div>
            <div className={styles.card}>
              <div className={styles.cardHeader}>
                <img
                  src={`/uploads/${s.stored_filename}`}
                  alt={`Meme ${s.sequence_number}`}
                  className={styles.thumb}
                />
                <div className={styles.meta}>
                  <div className={styles.memeName}>
                    {s.meme_identified_as ?? "Pending interpretation"}
                  </div>
                  <div className={styles.timestamp}>
                    {new Date(s.submitted_at).toLocaleString()}
                  </div>
                  <code className={styles.hash}>
                    SHA-256: {s.sha256_hash.slice(0, 20)}...
                  </code>
                </div>
              </div>
              {s.interpretation && (
                <div className={styles.details}>
                  <p className={styles.interpretation}>{s.interpretation}</p>
                  <div className={styles.action}>
                    <span className={styles.actionLabel}>→ Action</span>
                    {s.proposed_action}
                  </div>
                </div>
              )}
            </div>
          </div>
        ))}
        {submissions.length === 0 && (
          <div className={styles.empty}>No memes submitted yet.</div>
        )}
      </div>
    </div>
  );
}
