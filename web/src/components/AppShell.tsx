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
    `flex items-center gap-3 px-4 py-3 rounded-full text-sm font-bold transition-all duration-200 ${
      isActive
        ? "bg-[#13426f] text-white shadow-md"
        : "text-[#616c8a] hover:bg-[#bde1f9]/40 hover:text-[#13426f]"
    }`;

  return (
    <div className="min-h-screen bg-[#f9f7f0] text-[#333333]">
      {/* Header */}
      <nav className="fixed top-0 w-full z-50 flex justify-between items-center px-6 md:px-10 h-20 bg-[#f9f7f0]/90 backdrop-blur-md border-b border-[#d0d5dd]">
        <div className="flex items-center gap-8">
          <Link to={homePath} className="flex items-center gap-2 text-2xl font-extrabold text-[#13426f] tracking-tight">
            <span className="w-9 h-9 rounded-full bg-[#2e96ff] text-white flex items-center justify-center font-black text-lg shadow-[rgba(154,207,246,0.5)_0px_4px_0px_0px]">
              A
            </span>
            Auditra
          </Link>
          <div className="hidden md:flex items-center gap-3">
            {!isAuditor && (
              <NavLink
                to="/dashboard"
                className={({ isActive }) =>
                  `px-5 py-2 rounded-full font-bold text-sm transition-all ${
                    isActive
                      ? "bg-[#13426f] text-white shadow-sm"
                      : "text-[#616c8a] hover:text-[#13426f] hover:bg-[#bde1f9]/40"
                  }`
                }
              >
                Employee Dashboard
              </NavLink>
            )}
            {isAuditor && (
              <NavLink
                to="/auditor"
                className={({ isActive }) =>
                  `px-5 py-2 rounded-full font-bold text-sm transition-all ${
                    isActive
                      ? "bg-[#13426f] text-white shadow-sm"
                      : "text-[#616c8a] hover:text-[#13426f] hover:bg-[#bde1f9]/40"
                  }`
                }
              >
                Auditor Dashboard
              </NavLink>
            )}
          </div>
        </div>
        <div className="flex items-center gap-4">
          <div className="hidden sm:flex items-center gap-3 px-4 py-2 rounded-full bg-[#bde1f9]/50 border border-[#2e96ff]/30 text-[#13426f]">
            <span className="w-2.5 h-2.5 rounded-full bg-[#2e96ff]"></span>
            <div className="text-left">
              <p className="text-xs font-bold leading-none">{user?.username}</p>
              <p className="text-[10px] font-semibold text-[#616c8a] uppercase mt-0.5">
                {user?.role} · {user?.grade}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={handleLogout}
            className="p-2.5 text-[#13426f] bg-white border border-[#d0d5dd] hover:bg-[#2e96ff] hover:text-white hover:border-[#2e96ff] rounded-full transition-all duration-150 shadow-sm"
            title="Logout"
          >
            <Icon name="logout" />
          </button>
        </div>
      </nav>

      {/* Sidebar */}
      <aside className="fixed left-0 top-0 h-full hidden lg:flex flex-col p-6 border-r border-[#d0d5dd] bg-[#f9f7f0] w-64 z-40 pt-28">
        <div className="mb-6 px-3">
          <h2 className="font-extrabold text-[#13426f] tracking-tight text-sm uppercase">Auditra Workspace</h2>
          <p className="text-xs text-[#616c8a] font-medium">Policy-First AI Auditor</p>
        </div>
        <nav className="flex-1 space-y-2">
          {!isAuditor && (
            <NavLink to="/dashboard" className={navCls} end>
              <Icon name="dashboard" />
              Employee View
            </NavLink>
          )}
          {isAuditor && (
            <NavLink to="/auditor" className={navCls}>
              <Icon name="fact_check" />
              Auditor View
            </NavLink>
          )}
        </nav>
        <button
          type="button"
          onClick={handleLogout}
          className="mt-auto flex items-center gap-3 px-5 py-3 rounded-full text-sm font-bold text-[#616c8a] hover:bg-[#2e96ff] hover:text-white transition-all shadow-sm"
        >
          <Icon name="logout" />
          <span>Sign Out</span>
        </button>
      </aside>

      {/* Main Content */}
      <main className="lg:pl-64 pt-28 pb-16 px-6 md:px-10">
        <div className="max-w-7xl mx-auto">
          <header className="flex flex-col md:flex-row md:items-end justify-between mb-10 gap-6">
            <div>
              <h1 className="text-3xl md:text-4xl font-extrabold tracking-tight text-[#13426f] mb-2 font-headline">
                {title}
              </h1>
              {subtitle && <p className="text-[#616c8a] max-w-xl text-base">{subtitle}</p>}
            </div>
            {actions && <div className="flex flex-wrap gap-3">{actions}</div>}
          </header>
          {children}
        </div>
      </main>
    </div>
  );
}
