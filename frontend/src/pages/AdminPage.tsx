import { useEffect, useState } from "react";
import { useAuth } from "../context/AuthContext.tsx";
import styles from "./AdminPage.module.css";

interface Team {
  id: string;
  name: string;
  access_code: string;
  project_id: string;
  project_title: string;
  meme_count: number;
}

export default function AdminPage() {
  const { session } = useAuth();
  const [teams, setTeams] = useState<Team[]>([]);
  const [newTeamName, setNewTeamName] = useState("");
  const [newTeamCode, setNewTeamCode] = useState("");
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState("");

  const adminCode = session?.adminCode ?? "ADMIN2024";

  const loadTeams = () => {
    fetch("/api/admin/teams", {
      headers: { "x-admin-code": adminCode },
    })
      .then((r) => r.json())
      .then((data: Team[]) => setTeams(data))
      .catch(() => {});
  };

  useEffect(loadTeams, [adminCode]);

  const handleCreateTeam = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreating(true);
    setError("");
    try {
      const res = await fetch("/api/admin/teams", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-admin-code": adminCode,
        },
        body: JSON.stringify({
          name: newTeamName,
          access_code: newTeamCode.toUpperCase(),
        }),
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) throw new Error(data.error ?? "Failed");
      setNewTeamName("");
      setNewTeamCode("");
      loadTeams();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to create team";
      setError(message);
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className={styles.page}>
      <h1 className={styles.title}>Admin Panel</h1>

      <div className={styles.section}>
        <h2 className={styles.sectionTitle}>Create Team</h2>
        <form onSubmit={handleCreateTeam} className={styles.form}>
          <input
            value={newTeamName}
            onChange={(e) => setNewTeamName(e.target.value)}
            placeholder="Team name"
            className={styles.input}
            required
          />
          <input
            value={newTeamCode}
            onChange={(e) => setNewTeamCode(e.target.value.toUpperCase())}
            placeholder="Access code (e.g. ALPHA42)"
            className={styles.input}
            required
          />
          {error && <div className={styles.error}>{error}</div>}
          <button type="submit" className={styles.btn} disabled={creating}>
            {creating ? "Creating..." : "Create Team"}
          </button>
        </form>
      </div>

      <div className={styles.section}>
        <h2 className={styles.sectionTitle}>Teams ({teams.length})</h2>
        <div className={styles.teamList}>
          {teams.map((t) => (
            <div key={t.id} className={styles.teamCard}>
              <div className={styles.teamName}>{t.name}</div>
              <div className={styles.teamMeta}>
                <code className={styles.code}>{t.access_code}</code>
                <span className={styles.memeCount}>{t.meme_count} memes</span>
              </div>
              <div className={styles.teamActions}>
                <a
                  href={`/api/audit/${t.project_id}/export`}
                  target="_blank"
                  rel="noreferrer"
                  className={styles.linkBtn}
                >
                  Export audit log
                </a>
              </div>
            </div>
          ))}
          {teams.length === 0 && (
            <div className={styles.empty}>
              No teams yet. Create one above.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
