import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { Icon } from "../components/Icon";

export function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const token = await login({ username, password });
      navigate(token.role === "auditor" ? "/auditor" : "/dashboard", { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Login failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-background text-on-surface flex items-center justify-center relative overflow-hidden">
      <div className="absolute inset-0 z-0 pointer-events-none">
        <div className="absolute top-[-10%] right-[-5%] w-2/3 h-2/3 bg-secondary-container/20 rounded-full blur-[120px]" />
        <div className="absolute bottom-[-10%] left-[-5%] w-1/2 h-1/2 bg-primary-fixed/30 rounded-full blur-[100px]" />
      </div>

      <main className="relative z-10 w-full max-w-md px-6 py-12">
        <div className="text-center mb-10">
          <div className="flex justify-center mb-4">
            <div className="h-12 w-12 bg-primary flex items-center justify-center rounded-lg shadow-lg">
              <Icon name="account_balance" className="text-on-primary text-3xl" />
            </div>
          </div>
          <h1 className="text-4xl font-extrabold tracking-tight text-on-surface mb-2 font-[family-name:var(--font-headline)]">
            Auditra
          </h1>
          <p className="text-secondary font-medium tracking-wide text-xs uppercase">
            Audit with Aura
          </p>
        </div>

        <div className="glass-panel ambient-shadow rounded-xl p-8 border border-outline-variant/20">
          <div className="mb-8">
            <h2 className="text-2xl font-bold text-on-surface font-[family-name:var(--font-headline)]">
              Secure Access
            </h2>
            <p className="text-on-surface-variant text-sm mt-1">Enterprise auditing workspace login.</p>
          </div>

          <form className="space-y-6" onSubmit={onSubmit}>
            {error && (
              <div className="rounded-lg bg-error-container/80 text-on-error-container text-sm px-4 py-3">
                {error}
              </div>
            )}

            <div>
              <label
                className="block text-xs font-bold text-secondary uppercase tracking-widest mb-2"
                htmlFor="username"
              >
                Username
              </label>
              <div className="relative group">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Icon name="alternate_email" className="text-outline text-xl group-focus-within:text-primary" />
                </div>
                <input
                  id="username"
                  autoComplete="username"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="w-full pl-10 pr-4 py-3 bg-surface-container-high border-none rounded-lg focus:ring-0 text-on-surface placeholder:text-outline/70 transition-all border-b-2 border-transparent focus:border-primary outline-none"
                  placeholder="employee"
                  required
                />
              </div>
            </div>

            <div>
              <label
                className="block text-xs font-bold text-secondary uppercase tracking-widest mb-2"
                htmlFor="password"
              >
                Password
              </label>
              <div className="relative group">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Icon name="lock" className="text-outline text-xl group-focus-within:text-primary" />
                </div>
                <input
                  id="password"
                  type="password"
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full pl-10 pr-4 py-3 bg-surface-container-high border-none rounded-lg focus:ring-0 text-on-surface placeholder:text-outline/70 border-b-2 border-transparent focus:border-primary outline-none"
                  placeholder="••••••••"
                  required
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-4 bg-gradient-to-br from-primary to-primary-container text-on-primary rounded-lg font-bold tracking-tight text-sm shadow-xl hover:opacity-95 hover:scale-[0.99] transition-all flex items-center justify-center gap-2 disabled:opacity-60"
            >
              <Icon name="login" className="text-lg" />
              {loading ? "Signing in…" : "Authenticate Workspace"}
            </button>
          </form>

          <p className="mt-8 text-center text-on-surface-variant text-sm">
            New to the platform?{" "}
            <Link className="text-primary font-bold hover:underline" to="/register">
              Register
            </Link>
          </p>
        </div>

        <p className="mt-6 text-center text-xs text-outline">
          Demo: <code className="text-on-surface">employee</code> /{" "}
          <code className="text-on-surface">employee123</code> ·{" "}
          <code className="text-on-surface">auditor</code> /{" "}
          <code className="text-on-surface">auditor123</code>
        </p>
      </main>
    </div>
  );
}
