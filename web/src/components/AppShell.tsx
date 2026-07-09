import { Link, NavLink, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { Icon } from "./Icon";

export function AppShell({
  children,
  title,
  subtitle,
  actions,
}: {
  children: React.ReactNode;
  title: string;
  subtitle?: string;
  actions?: React.ReactNode;
}) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const isAuditor = user?.role === "auditor";
  const homePath = isAuditor ? "/auditor" : "/dashboard";

  function handleLogout() {
    logout();
    navigate("/login");
  }

  const navCls = ({ isActive }: { isActive: boolean }) =>
    `flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-all duration-200 ${
      isActive
        ? "bg-surface-container-high text-on-surface font-bold shadow-sm"
        : "text-on-surface-variant hover:bg-surface-container-low hover:text-on-surface hover:opacity-90"
    }`;

  return (
    <div className="min-h-screen bg-background text-on-surface">
      <nav className="fixed top-0 w-full z-50 flex justify-between items-center px-6 md:px-8 h-16 bg-surface-container-low/80 backdrop-blur-xl border-b border-outline/30">
        <div className="flex items-center gap-8">
          <Link to={homePath} className="text-2xl font-bold tracking-tight text-on-surface font-[family-name:var(--font-headline)]">
            Auditra
          </Link>
          <div className="hidden md:flex items-center gap-6">
            {!isAuditor && (
              <NavLink
                to="/dashboard"
                className={({ isActive }) =>
                  isActive
                    ? "text-on-surface font-semibold border-b-2 border-on-surface py-1 transition-opacity duration-200 hover:opacity-80"
                    : "text-on-surface-variant hover:text-on-surface py-1 transition-opacity duration-200 hover:opacity-80"
                }
              >
                Employee dashboard
              </NavLink>
            )}
            {isAuditor && (
              <NavLink
                to="/auditor"
                className={({ isActive }) =>
                  isActive
                    ? "text-on-surface font-semibold border-b-2 border-on-surface py-1 transition-opacity duration-200 hover:opacity-80"
                    : "text-on-surface-variant hover:text-on-surface py-1 transition-opacity duration-200 hover:opacity-80"
                }
              >
                Auditor dashboard
              </NavLink>
            )}
          </div>
        </div>
        <div className="flex items-center gap-4">
          <div className="text-right hidden sm:block">
            <p className="text-sm font-bold leading-none text-on-surface">{user?.username}</p>
            <p className="text-[10px] text-on-surface-variant uppercase tracking-wider mt-1">
              {user?.role} · {user?.grade}
            </p>
          </div>
          <button
            type="button"
            onClick={handleLogout}
            className="p-2 text-on-surface-variant hover:bg-surface-container rounded-full transition-colors"
            title="Logout"
          >
            <Icon name="logout" />
          </button>
        </div>
      </nav>

      <aside className="fixed left-0 top-0 h-full hidden lg:flex flex-col p-4 border-r border-outline/30 bg-surface-container-low w-64 z-40 pt-20">
        <div className="mb-8 px-4">
          <h2 className="font-black text-on-surface tracking-tight text-sm">Auditra Platform</h2>
          <p className="text-xs text-on-surface-variant">Audit with Aura</p>
        </div>
        <nav className="flex-1 space-y-2">
          {!isAuditor && (
            <NavLink to="/dashboard" className={navCls} end>
              <Icon name="dashboard" />
              Employee dashboard
            </NavLink>
          )}
          {isAuditor && (
            <NavLink to="/auditor" className={navCls}>
              <Icon name="fact_check" />
              Auditor dashboard
            </NavLink>
          )}
        </nav>
        <button
          type="button"
          onClick={handleLogout}
          className="mt-auto flex items-center gap-3 px-4 py-2 text-on-surface-variant hover:text-on-surface"
        >
          <Icon name="logout" />
          <span className="text-sm">Logout</span>
        </button>
      </aside>

      <main className="lg:pl-64 pt-24 pb-12 px-6 md:px-8">
        <div className="max-w-7xl mx-auto">
          <header className="flex flex-col md:flex-row md:items-end justify-between mb-10 gap-6">
            <div>
              <h1 className="text-3xl md:text-4xl font-extrabold tracking-tight text-on-surface mb-2 font-[family-name:var(--font-headline)]">
                {title}
              </h1>
              {subtitle && <p className="text-secondary max-w-xl text-sm md:text-base">{subtitle}</p>}
            </div>
            {actions && <div className="flex flex-wrap gap-3">{actions}</div>}
          </header>
          {children}
        </div>
      </main>
    </div>
  );
}
