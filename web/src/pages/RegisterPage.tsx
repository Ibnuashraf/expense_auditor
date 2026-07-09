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
    <div className="min-h-screen bg-background flex items-center justify-center px-6 py-12">
      <div className="w-full max-w-md glass-panel ambient-shadow rounded-xl p-8 border border-outline-variant/20">
        <Link
          to="/login"
          className="inline-flex items-center text-sm font-semibold text-surface-tint hover:underline mb-6"
        >
          <Icon name="arrow_back" className="text-sm mr-1" /> Back to login
        </Link>
        <h1 className="text-2xl font-bold font-[family-name:var(--font-headline)] mb-2">Create account</h1>
        <p className="text-on-surface-variant text-sm mb-8">Register for the Auditra workspace.</p>

        <form className="space-y-4" onSubmit={onSubmit}>
          {error && (
            <div className="rounded-lg bg-error-container/80 text-on-error-container text-sm px-4 py-3">{error}</div>
          )}
          <input
            className="w-full px-4 py-3 rounded-lg bg-surface-container-high outline-none focus:ring-2 ring-surface-tint/30"
            placeholder="Username"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            required
          />
          <input
            className="w-full px-4 py-3 rounded-lg bg-surface-container-high outline-none focus:ring-2 ring-surface-tint/30"
            placeholder="Email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
          <input
            className="w-full px-4 py-3 rounded-lg bg-surface-container-high outline-none focus:ring-2 ring-surface-tint/30"
            placeholder="Password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
          <div className="flex gap-4">
            <select
              className="flex-1 px-4 py-3 rounded-lg bg-surface-container-high outline-none"
              value={role}
              onChange={(e) => setRole(e.target.value as "employee" | "auditor")}
            >
              <option value="employee">Employee</option>
              <option value="auditor">Auditor</option>
            </select>
            <input
              className="w-24 px-3 py-3 rounded-lg bg-surface-container-high outline-none"
              placeholder="Grade"
              value={grade}
              onChange={(e) => setGrade(e.target.value)}
            />
          </div>
          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 bg-primary text-on-primary rounded-lg font-bold disabled:opacity-60"
          >
            {loading ? "Creating…" : "Register"}
          </button>
        </form>
      </div>
    </div>
  );
}
