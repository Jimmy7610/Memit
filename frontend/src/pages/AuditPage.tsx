import { useEffect, useState } from "react";
import { useAuth } from "../context/AuthContext.tsx";
import styles from "./AuditPage.module.css";

interface VerifyResult {
  valid: boolean;
  totalEntries: number;
  firstBrokenAt?: number;
  entries: Array<{ sequence: number; valid: boolean; chain_hash: string }>;
}

interface AuditEntry {
  id: string;
  sequence: number;
  event_type: string;
  timestamp: string;
  payload_hash: string;
  previous_entry_hash: string;
  chain_hash: string;
}

export default function AuditPage() {
  const { session } = useAuth();
  const [entries, setEntries] = useState<AuditEntry[]>([]);
  const [verify, setVerify] = useState<VerifyResult | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!session?.projectId) return;
    Promise.all([
      fetch(`/api/audit/${session.projectId}`).then((r) =>
        r.json()
      ) as Promise<AuditEntry[]>,
      fetch(`/api/audit/${session.projectId}/verify`).then((r) =>
        r.json()
      ) as Promise<VerifyResult>,
    ])
      .then(([log, v]) => {
        setEntries(log);
        setVerify(v);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [session?.projectId]);

  const handleExport = () => {
    window.open(`/api/audit/${session?.projectId}/export`, "_blank");
  };

  if (loading)
    return <div className={styles.loading}>Loading audit log...</div>;

  return (
    <div className={styles.page}>
      <div className={styles.pageHeader}>
        <div>
          <h1 className={styles.title}>Audit Log</h1>
          <p className={styles.subtitle}>
            Tamper-evident SHA-256 chain — {entries.length} entries
          </p>
        </div>
        <button onClick={handleExport} className={styles.exportBtn}>
          Export JSON
        </button>
      </div>

      {verify && (
        <div
          className={`${styles.verifyBanner} ${verify.valid ? styles.valid : styles.invalid}`}
        >
          <span className={styles.verifyIcon}>
            {verify.valid ? "✓" : "✗"}
          </span>
          <div>
            <div className={styles.verifyTitle}>
              {verify.valid
                ? "Chain integrity verified"
                : "Chain integrity VIOLATED"}
            </div>
            <div className={styles.verifyMeta}>
              {verify.totalEntries} entries checked
              {!verify.valid &&
                verify.firstBrokenAt &&
                ` · Broken at entry #${verify.firstBrokenAt}`}
            </div>
          </div>
        </div>
      )}

      <div className={styles.log}>
        {entries.map((entry) => (
          <div key={entry.id} className={styles.entry}>
            <div className={styles.entryLeft}>
              <div className={styles.seq}>#{entry.sequence}</div>
              <div className={styles.connector} />
            </div>
            <div className={styles.entryCard}>
              <div className={styles.entryHeader}>
                <span
                  className={`${styles.eventType} ${styles[entry.event_type.replace(/_/g, "")]}`}
                >
                  {entry.event_type}
                </span>
                <span className={styles.entryTime}>
                  {new Date(entry.timestamp).toLocaleString()}
                </span>
              </div>
              <div className={styles.hashes}>
                <div className={styles.hashRow}>
                  <span className={styles.hashLabel}>payload</span>
                  <code className={styles.hashVal}>
                    {entry.payload_hash.slice(0, 32)}...
                  </code>
                </div>
                <div className={styles.hashRow}>
                  <span className={styles.hashLabel}>prev</span>
                  <code className={styles.hashVal}>
                    {entry.previous_entry_hash.slice(0, 32)}...
                  </code>
                </div>
                <div className={styles.hashRow}>
                  <span className={styles.hashLabel}>chain</span>
                  <code className={`${styles.hashVal} ${styles.chainHash}`}>
                    {entry.chain_hash.slice(0, 32)}...
                  </code>
                </div>
              </div>
            </div>
          </div>
        ))}
        {entries.length === 0 && (
          <div className={styles.empty}>
            No audit entries yet. Submit a meme to start the chain.
          </div>
        )}
      </div>
    </div>
  );
}
