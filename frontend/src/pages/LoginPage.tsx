import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext.tsx";
import styles from "./LoginPage.module.css";

export default function LoginPage() {
  const [mode, setMode] = useState<"team" | "admin">("team");
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const { loginTeam, loginAdmin } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      if (mode === "team") {
        await loginTeam(code.trim().toUpperCase());
        navigate("/dashboard");
      } else {
        await loginAdmin(code.trim());
        navigate("/admin");
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Login failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={styles.page}>
      <div className={styles.card}>
        <div className={styles.title}>MEMIT</div>
        <div className={styles.subtitle}>Meme Driven Development</div>
        <div className={styles.tagline}>No text. Only memes.</div>

        <div className={styles.tabs}>
          <button
            type="button"
            className={mode === "team" ? styles.tabActive : styles.tab}
            onClick={() => { setMode("team"); setCode(""); setError(""); }}
          >
            Team Login
          </button>
          <button
            type="button"
            className={mode === "admin" ? styles.tabActive : styles.tab}
            onClick={() => { setMode("admin"); setCode(""); setError(""); }}
          >
            Admin
          </button>
        </div>

        <form onSubmit={handleSubmit} className={styles.form}>
          <label className={styles.label}>
            {mode === "team" ? "Team Access Code" : "Admin Code"}
          </label>
          <input
            type={mode === "admin" ? "password" : "text"}
            value={code}
            onChange={(e) => setCode(e.target.value)}
            placeholder={mode === "team" ? "e.g. ALPHA42" : "••••••••"}
            className={styles.input}
            autoComplete="off"
            autoCapitalize="characters"
            autoCorrect="off"
            spellCheck={false}
            autoFocus
          />
          {error && <div className={styles.error}>{error}</div>}
          <button type="submit" className={styles.button} disabled={loading || !code.trim()}>
            {loading ? "Logging in…" : "Enter"}
          </button>
        </form>
      </div>
    </div>
  );
}
