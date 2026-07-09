import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { AppShell } from "../components/AppShell";
import { NewExpenseModal } from "../components/NewExpenseModal";
import { RiskBadge, StatusBadge } from "../components/StatusBadge";
import { Icon } from "../components/Icon";
import { api, type Expense } from "../lib/api";
import { formatDisplayDate, formatMoney } from "../lib/format";

function categoryIcon(cat: string | null) {
  const c = (cat || "").toLowerCase();
  if (c.includes("meal") || c.includes("food")) return "restaurant";
  if (c.includes("lodg") || c.includes("hotel")) return "hotel";
  if (c.includes("transport") || c.includes("flight")) return "flight";
  return "receipt_long";
}

export function DashboardPage() {
  const [items, setItems] = useState<Expense[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [modal, setModal] = useState(false);
  const navigate = useNavigate();

  const load = useCallback(async () => {
    setErr(null);
    setLoading(true);
    try {
      const data = await api.expenses({
        search: search.trim() || undefined,
        sort_by: "date",
      });
      setItems(data);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  }, [search]);

  useEffect(() => {
    const delay = search ? 320 : 0;
    const t = window.setTimeout(() => load(), delay);
    return () => window.clearTimeout(t);
  }, [load, search]);

  const total = items.reduce((s, e) => s + (e.amount || 0), 0);
  const pending = items.filter((e) => e.status === "pending").length;
  const flagged = items.filter((e) => e.status === "flagged").length;

  return (
    <AppShell
      title="Employee Dashboard"
      subtitle="Submit and track your expenses with policy-aware validation and audit status."
      actions={
        <>
          <button
            type="button"
            onClick={() => setModal(true)}
            className="bg-gradient-to-br from-primary to-primary-container text-on-primary px-6 py-3 rounded-lg font-bold shadow-md hover:opacity-90 transition-opacity flex items-center gap-2 animate-in slide-in-from-right fade-in"
          >
            <Icon name="add" />
            New expense
          </button>
        </>
      }
    >
      <NewExpenseModal
        open={modal}
        onClose={() => setModal(false)}
        onCreated={(id) => navigate(`/expense/${id}`)}
      />

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12 animate-in slide-in-from-bottom-4 fade-in duration-500">
        <div className="bg-surface-container-lowest p-8 rounded-xl custom-shadow relative overflow-hidden hover:scale-[1.02] transition-transform">
          <div className="absolute top-0 right-0 p-6 opacity-10">
            <Icon name="payments" className="text-6xl" />
          </div>
          <p className="text-sm font-medium text-secondary uppercase tracking-widest mb-4">Total (loaded)</p>
          <div className="flex items-baseline gap-2">
            <h2 className="text-4xl font-extrabold text-on-surface font-[family-name:var(--font-headline)]">
              {formatMoney(total)}
            </h2>
          </div>
          <p className="text-xs text-secondary mt-4">{items.length} expense(s) in view</p>
        </div>
        <div className="bg-surface-container-lowest p-8 rounded-xl custom-shadow border-l-4 border-surface-tint">
          <p className="text-sm font-medium text-secondary uppercase tracking-widest mb-4">Pending</p>
          <div className="flex items-baseline gap-2">
            <h2 className="text-4xl font-extrabold text-on-surface font-[family-name:var(--font-headline)]">
              {String(pending).padStart(2, "0")}
            </h2>
            <span className="text-xs font-medium text-secondary">transactions</span>
          </div>
        </div>
        <div className="bg-tertiary-container p-8 rounded-xl relative text-on-tertiary-container">
          <p className="text-sm font-medium uppercase tracking-widest mb-4 opacity-90">Flagged</p>
          <div className="flex items-center gap-4">
            <h2 className="text-4xl font-extrabold text-white">{String(flagged).padStart(2, "0")}</h2>
            <Icon name="warning" className="text-tertiary-fixed text-2xl" filled />
          </div>
          <p className="text-sm mt-4 opacity-80 leading-relaxed">Items requiring attention per policy engine.</p>
        </div>
      </div>

      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <h3 className="text-2xl font-bold tracking-tight text-on-surface font-[family-name:var(--font-headline)]">
            Recent expenses
          </h3>
          <div className="relative w-full sm:w-72">
            <Icon name="search" className="absolute left-3 top-1/2 -translate-y-1/2 text-outline text-lg" />
            <input
              className="w-full pl-10 pr-4 py-2 bg-surface-container-high border-none rounded-lg text-sm focus:ring-2 ring-surface-tint/30 outline-none"
              placeholder="Search merchant, purpose…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && load()}
            />
          </div>
        </div>

        {err && (
          <div className="rounded-lg bg-error-container/50 text-on-error-container px-4 py-3 text-sm">{err}</div>
        )}

        <div className="bg-surface-container-lowest rounded-xl overflow-hidden custom-shadow">
          {loading ? (
            <p className="p-8 text-secondary text-center">Loading expenses…</p>
          ) : items.length === 0 ? (
            <p className="p-8 text-secondary text-center">No expenses yet. Create one to get started.</p>
          ) : (
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-surface-container-low">
                  <th className="px-6 py-4 text-[10px] font-bold uppercase tracking-widest text-secondary">Date</th>
                  <th className="px-6 py-4 text-[10px] font-bold uppercase tracking-widest text-secondary">Merchant</th>
                  <th className="px-6 py-4 text-[10px] font-bold uppercase tracking-widest text-secondary">Category</th>
                  <th className="px-6 py-4 text-[10px] font-bold uppercase tracking-widest text-secondary text-right">
                    Amount
                  </th>
                  <th className="px-6 py-4 text-[10px] font-bold uppercase tracking-widest text-secondary text-center">
                    Status
                  </th>
                  <th className="px-6 py-4 text-[10px] font-bold uppercase tracking-widest text-secondary text-center">
                    Risk
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-surface-container">
                {items.map((row) => (
                  <tr
                    key={row.id}
                    className="hover:bg-surface-container-low/50 transition-colors cursor-pointer"
                    onClick={() => navigate(`/expense/${row.id}`)}
                  >
                    <td className="px-6 py-5 text-sm text-secondary">{formatDisplayDate(row.date || row.created_at)}</td>
                    <td className="px-6 py-5">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded bg-surface-container flex items-center justify-center">
                          <Icon name={categoryIcon(row.category)} className="text-sm" />
                        </div>
                        <span className="text-sm font-semibold text-on-surface">{row.merchant || "—"}</span>
                      </div>
                    </td>
                    <td className="px-6 py-5 text-sm text-on-surface-variant">{row.category || "—"}</td>
                    <td className="px-6 py-5 text-sm font-bold text-on-surface text-right">{formatMoney(row.amount)}</td>
                    <td className="px-6 py-5 text-center">
                      <StatusBadge status={row.status} />
                    </td>
                    <td className="px-6 py-5 text-center">
                      <RiskBadge risk={row.risk_level} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </AppShell>
  );
}
