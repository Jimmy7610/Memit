import { createContext, useContext, useState, useEffect } from "react";

interface Session {
  role: "team" | "admin";
  teamId?: string;
  teamName?: string;
  projectId?: string;
  projectTitle?: string;
  adminCode?: string;
}

interface AuthContextValue {
  session: Session | null;
  loginTeam: (code: string) => Promise<void>;
  loginAdmin: (code: string) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(() => {
    const stored = localStorage.getItem("memit_session");
    return stored ? (JSON.parse(stored) as Session) : null;
  });

  useEffect(() => {
    if (session) {
      localStorage.setItem("memit_session", JSON.stringify(session));
    } else {
      localStorage.removeItem("memit_session");
    }
  }, [session]);

  const loginTeam = async (code: string) => {
    const res = await fetch("/api/team/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ access_code: code }),
    });
    if (!res.ok) {
      const err = (await res.json()) as { error?: string };
      throw new Error(err.error ?? "Login failed");
    }
    const data = (await res.json()) as {
      team: { id: string; name: string };
      project: { id: string; title: string; status: string } | null;
    };
    setSession({
      role: "team",
      teamId: data.team.id,
      teamName: data.team.name,
      projectId: data.project?.id,
      projectTitle: data.project?.title,
    });
  };

  const loginAdmin = async (code: string) => {
    const res = await fetch("/api/admin/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code }),
    });
    if (!res.ok) throw new Error("Invalid admin code");
    setSession({ role: "admin", adminCode: code });
  };

  const logout = () => setSession(null);

  return (
    <AuthContext.Provider value={{ session, loginTeam, loginAdmin, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
