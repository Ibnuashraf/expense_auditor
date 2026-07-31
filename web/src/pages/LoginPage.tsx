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
    <div className="min-h-screen bg-[#f9f7f0] text-[#333333] flex items-center justify-center relative overflow-hidden px-4">
      <main className="relative z-10 w-full max-w-md py-12">
        <div className="text-center mb-8">
          <div className="flex justify-center mb-3">
            <div className="w-14 h-14 bg-[#2e96ff] text-white flex items-center justify-center rounded-full font-black text-2xl shadow-[rgba(154,207,246,0.5)_0px_7px_0px_0px]">
              A
            </div>
          </div>
          <h1 className="text-4xl font-extrabold tracking-tight text-[#13426f] mb-1 font-headline">
            Auditra
          </h1>
          <p className="text-[#616c8a] font-bold tracking-widest text-xs uppercase">
            Policy-First AI Auditor
          </p>
        </div>

        <div className="bg-white rounded-[26px] p-8 md:p-10 border border-[#d0d5dd] shadow-lg">
          <div className="mb-6">
            <h2 className="text-2xl font-extrabold text-[#13426f] font-headline">
              Secure Access
            </h2>
            <p className="text-[#616c8a] text-sm mt-1 font-semibold">Enter your workspace credentials to continue.</p>
          </div>

          <form className="space-y-5" onSubmit={onSubmit}>
            {error && (
              <div className="rounded-2xl bg-[#f8d7da] text-[#721c24] border border-[#f5c6cb] text-xs font-bold px-4 py-3">
                {error}
              </div>
            )}

            <div>
              <label
                className="block text-xs font-bold text-[#616c8a] uppercase tracking-wider mb-2"
                htmlFor="username"
              >
                Username
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-[#616c8a]">
                  <Icon name="alternate_email" className="text-lg" />
                </div>
                <input
                  id="username"
                  autoComplete="username"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="w-full pl-11 pr-4 py-3.5 bg-[#f9f7f0] border border-[#d0d5dd] rounded-full text-sm font-semibold text-[#333333] placeholder:text-[#616c8a]/60 outline-none focus:ring-2 focus:ring-[#2e96ff]"
                  placeholder="employee"
                  required
                />
              </div>
            </div>

            <div>
              <label
                className="block text-xs font-bold text-[#616c8a] uppercase tracking-wider mb-2"
                htmlFor="password"
              >
                Password
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-[#616c8a]">
                  <Icon name="lock" className="text-lg" />
                </div>
                <input
                  id="password"
                  type="password"
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full pl-11 pr-4 py-3.5 bg-[#f9f7f0] border border-[#d0d5dd] rounded-full text-sm font-semibold text-[#333333] placeholder:text-[#616c8a]/60 outline-none focus:ring-2 focus:ring-[#2e96ff]"
                  placeholder="••••••••"
                  required
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-4 bg-[#2e96ff] text-white rounded-full font-extrabold tracking-tight text-base shadow-[rgba(154,207,246,0.5)_0px_7px_0px_0px] hover:translate-y-[2px] transition-all flex items-center justify-center gap-2 disabled:opacity-60"
            >
              <Icon name="login" className="text-xl" />
              {loading ? "Authenticating…" : "Authenticate Workspace"}
            </button>
          </form>

          <p className="mt-8 text-center text-[#616c8a] text-sm font-semibold">
            New to the platform?{" "}
            <Link className="text-[#2e96ff] font-extrabold hover:underline" to="/register">
              Create an account
            </Link>
          </p>
        </div>

        <div className="mt-6 text-center text-xs text-[#616c8a] bg-[#bde1f9]/40 py-3 px-4 rounded-full border border-[#2e96ff]/20">
          Demo Credentials: <span className="font-bold text-[#13426f]">employee / employee123</span> · <span className="font-bold text-[#13426f]">auditor / auditor123</span>
        </div>
      </main>
    </div>
  );
}
