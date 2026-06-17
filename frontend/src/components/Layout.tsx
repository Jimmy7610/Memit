import { Outlet, NavLink, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext.tsx";
import styles from "./Layout.module.css";

interface LayoutProps {
  isAdmin?: boolean;
}

export default function Layout({ isAdmin = false }: LayoutProps) {
  const { session, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate("/login");
  };

  return (
    <div className={styles.shell}>
      <header className={styles.header}>
        <div className={styles.logo}>
          <span className={styles.logoText}>MEMIT</span>
          <span className={styles.logoTag}>Meme Driven Development</span>
        </div>
        <nav className={styles.nav}>
          {!isAdmin && (
            <>
              <NavLink
                to="/dashboard"
                className={({ isActive }) =>
                  isActive ? styles.activeLink : styles.link
                }
              >
                Dashboard
              </NavLink>
              <NavLink
                to="/upload"
                className={({ isActive }) =>
                  isActive ? styles.activeLink : styles.link
                }
              >
                Upload Meme
              </NavLink>
              <NavLink
                to="/history"
                className={({ isActive }) =>
                  isActive ? styles.activeLink : styles.link
                }
              >
                History
              </NavLink>
              <NavLink
                to="/audit"
                className={({ isActive }) =>
                  isActive ? styles.activeLink : styles.link
                }
              >
                Audit Log
              </NavLink>
            </>
          )}
          {isAdmin && (
            <NavLink
              to="/admin"
              className={({ isActive }) =>
                isActive ? styles.activeLink : styles.link
              }
            >
              Admin
            </NavLink>
          )}
        </nav>
        <div className={styles.userInfo}>
          <span className={styles.teamBadge}>
            {isAdmin ? "ADMIN" : session?.teamName}
          </span>
          <button onClick={handleLogout} className={styles.logoutBtn}>
            Logout
          </button>
        </div>
      </header>
      <main className={styles.main}>
        <Outlet />
      </main>
    </div>
  );
}
