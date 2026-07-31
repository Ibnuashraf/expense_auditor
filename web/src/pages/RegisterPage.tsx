import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { api } from "../lib/api";
import { Icon } from "../components/Icon";

export function RegisterPage() {
  const navigate = useNavigate();
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<"employee" | "auditor">("employee");
  const [grade, setGrade] = useState("E-3");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await api.register({ username, email, password, role, grade });
      navigate("/login");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Registration failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-[#f9f7f0] text-[#333333] flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-md bg-white rounded-[26px] p-8 md:p-10 border border-[#d0d5dd] shadow-lg">
        <Link
          to="/login"
          className="inline-flex items-center text-xs font-bold text-[#2e96ff] hover:underline mb-6"
        >
          <Icon name="arrow_back" className="text-base mr-1" /> Back to Login
        </Link>
        <h1 className="text-3xl font-extrabold text-[#13426f] font-headline mb-1">Create Account</h1>
        <p className="text-[#616c8a] text-sm mb-6 font-semibold">Register for the Auditra policy platform.</p>

        <form className="space-y-4" onSubmit={onSubmit}>
          {error && (
            <div className="rounded-2xl bg-[#f8d7da] text-[#721c24] border border-[#f5c6cb] text-xs font-bold px-4 py-3">{error}</div>
          )}
          <div>
            <label className="block text-xs font-bold text-[#616c8a] uppercase tracking-wider mb-1">Username</label>
            <input
              className="w-full px-5 py-3.5 rounded-full bg-[#f9f7f0] border border-[#d0d5dd] text-sm font-semibold text-[#333333] outline-none focus:ring-2 focus:ring-[#2e96ff]"
              placeholder="Username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              required
            />
          </div>
          <div>
            <label className="block text-xs font-bold text-[#616c8a] uppercase tracking-wider mb-1">Email</label>
            <input
              className="w-full px-5 py-3.5 rounded-full bg-[#f9f7f0] border border-[#d0d5dd] text-sm font-semibold text-[#333333] outline-none focus:ring-2 focus:ring-[#2e96ff]"
              placeholder="Email address"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>
          <div>
            <label className="block text-xs font-bold text-[#616c8a] uppercase tracking-wider mb-1">Password</label>
            <input
              className="w-full px-5 py-3.5 rounded-full bg-[#f9f7f0] border border-[#d0d5dd] text-sm font-semibold text-[#333333] outline-none focus:ring-2 focus:ring-[#2e96ff]"
              placeholder="Password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>
          <div className="flex gap-3">
            <div className="flex-1">
              <label className="block text-xs font-bold text-[#616c8a] uppercase tracking-wider mb-1">Role</label>
              <select
                className="w-full px-5 py-3.5 rounded-full bg-[#f9f7f0] border border-[#d0d5dd] text-sm font-semibold text-[#333333] outline-none focus:ring-2 focus:ring-[#2e96ff]"
                value={role}
                onChange={(e) => setRole(e.target.value as "employee" | "auditor")}
              >
                <option value="employee">Employee</option>
                <option value="auditor">Auditor</option>
              </select>
            </div>
            <div className="w-28">
              <label className="block text-xs font-bold text-[#616c8a] uppercase tracking-wider mb-1">Grade</label>
              <input
                className="w-full px-4 py-3.5 rounded-full bg-[#f9f7f0] border border-[#d0d5dd] text-sm font-semibold text-[#333333] text-center outline-none focus:ring-2 focus:ring-[#2e96ff]"
                placeholder="E-3"
                value={grade}
                onChange={(e) => setGrade(e.target.value)}
              />
            </div>
          </div>
          <button
            type="submit"
            disabled={loading}
            className="w-full py-4 mt-2 bg-[#2e96ff] text-white rounded-full font-extrabold tracking-tight text-base shadow-[rgba(154,207,246,0.5)_0px_7px_0px_0px] hover:translate-y-[2px] transition-all disabled:opacity-60"
          >
            {loading ? "Creating Account…" : "Complete Registration"}
          </button>
        </form>
      </div>
    </div>
  );
}
