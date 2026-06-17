import { Outlet, NavLink, useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext.tsx";
import styles from "./Layout.module.css";

interface LayoutProps {
  isAdmin?: boolean;
}

export default function Layout({ isAdmin = false }: LayoutProps) {
  const { session, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const handleLogout = () => {
    logout();
    navigate("/login");
  };

  const navLinks = isAdmin
    ? [{ to: "/admin", label: "Admin", icon: "⚙️" }]
    : [
        { to: "/dashboard", label: "Dashboard", icon: "🏠" },
        { to: "/upload", label: "Upload", icon: "🖼️" },
        { to: "/history", label: "History", icon: "📜" },
        { to: "/audit", label: "Audit", icon: "🔗" },
      ];

  // Suppress unused warning — location is used to trigger re-renders on route change
  void location;

  return (
    <div className={styles.shell}>
      <header className={styles.header}>
        <div className={styles.logo}>
          <span className={styles.logoText}>MEMIT</span>
          <span className={styles.logoTag}>Meme Driven Dev</span>
        </div>
        <nav className={styles.desktopNav}>
          {navLinks.map((l) => (
            <NavLink
              key={l.to}
              to={l.to}
              className={({ isActive }) => isActive ? styles.activeLink : styles.link}
            >
              {l.label}
            </NavLink>
          ))}
        </nav>
        <div className={styles.userInfo}>
          <span className={styles.teamBadge}>{isAdmin ? "ADMIN" : session?.teamName}</span>
          <button onClick={handleLogout} className={styles.logoutBtn}>Logout</button>
        </div>
      </header>

      <main className={styles.main}>
        <Outlet />
      </main>

      {/* Mobile bottom nav */}
      <nav className={styles.mobileNav}>
        {navLinks.map((l) => (
          <NavLink
            key={l.to}
            to={l.to}
            className={({ isActive }) => `${styles.mobileNavItem} ${isActive ? styles.mobileNavActive : ""}`}
          >
            <span className={styles.mobileNavIcon}>{l.icon}</span>
            <span className={styles.mobileNavLabel}>{l.label}</span>
          </NavLink>
        ))}
      </nav>
    </div>
  );
}
