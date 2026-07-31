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
            className="bg-[#2e96ff] text-white px-7 py-3 rounded-full font-bold text-sm shadow-[rgba(154,207,246,0.5)_0px_7px_0px_0px] hover:translate-y-[2px] hover:shadow-[rgba(154,207,246,0.5)_0px_4px_0px_0px] transition-all flex items-center gap-2"
          >
            <Icon name="add" />
            New Expense
          </button>
        </>
      }
    >
      <NewExpenseModal
        open={modal}
        onClose={() => setModal(false)}
        onCreated={(id) => navigate(`/expense/${id}`)}
      />

      {/* Stat Cards - Relief Style */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12">
        {/* Navy Primary Feature Card */}
        <div className="bg-[#13426f] text-white p-7 rounded-[22px] shadow-sm relative overflow-hidden">
          <div className="absolute top-4 right-4 opacity-10">
            <Icon name="payments" className="text-7xl" />
          </div>
          <p className="text-xs font-bold text-[#bde1f9] uppercase tracking-wider mb-2">Total Claim Value</p>
          <h2 className="text-4xl font-extrabold text-white font-headline">
            {formatMoney(total)}
          </h2>
          <p className="text-xs text-[#bde1f9]/80 mt-4 font-semibold">{items.length} claim(s) tracked</p>
        </div>

        {/* Snow Card 1 */}
        <div className="bg-white p-7 rounded-[22px] border border-[#d0d5dd] shadow-sm">
          <p className="text-xs font-bold text-[#616c8a] uppercase tracking-wider mb-2">Pending Audits</p>
          <div className="flex items-baseline gap-2">
            <h2 className="text-4xl font-extrabold text-[#13426f] font-headline">
              {String(pending).padStart(2, "0")}
            </h2>
            <span className="text-xs font-bold text-[#616c8a]">claims</span>
          </div>
          <p className="text-xs text-[#616c8a] mt-4">Awaiting policy validation</p>
        </div>

        {/* Snow Card 2 - Flagged */}
        <div className="bg-white p-7 rounded-[22px] border border-[#d0d5dd] shadow-sm">
          <p className="text-xs font-bold text-[#616c8a] uppercase tracking-wider mb-2">Flagged Items</p>
          <div className="flex items-center gap-3">
            <h2 className="text-4xl font-extrabold text-[#13426f] font-headline">{String(flagged).padStart(2, "0")}</h2>
            <span className="px-3 py-1 rounded-full bg-[#fff3cd] text-[#856404] text-xs font-bold">Action Needed</span>
          </div>
          <p className="text-xs text-[#616c8a] mt-4">Requires auditor or user override</p>
        </div>
      </div>

      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <h3 className="text-2xl font-extrabold tracking-tight text-[#13426f] font-headline">
            Recent Expense Claims
          </h3>
          <div className="relative w-full sm:w-72">
            <Icon name="search" className="absolute left-4 top-1/2 -translate-y-1/2 text-[#616c8a] text-lg" />
            <input
              className="w-full pl-11 pr-4 py-2.5 bg-white border border-[#d0d5dd] rounded-full text-sm font-medium focus:ring-2 focus:ring-[#2e96ff] outline-none text-[#333333]"
              placeholder="Search merchant, purpose…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && load()}
            />
          </div>
        </div>

        {err && (
          <div className="rounded-2xl bg-[#f8d7da] text-[#721c24] border border-[#f5c6cb] px-5 py-3 text-sm font-bold">{err}</div>
        )}

        <div className="bg-white rounded-[22px] border border-[#d0d5dd] overflow-hidden shadow-sm">
          {loading ? (
            <p className="p-10 text-[#616c8a] font-semibold text-center">Loading expenses…</p>
          ) : items.length === 0 ? (
            <p className="p-10 text-[#616c8a] font-semibold text-center">No expenses yet. Click "New Expense" to start.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-[#f9f7f0] border-b border-[#d0d5dd]">
                    <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-[#616c8a]">Date</th>
                    <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-[#616c8a]">Merchant</th>
                    <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-[#616c8a]">Category</th>
                    <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-[#616c8a] text-right">
                      Amount
                    </th>
                    <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-[#616c8a] text-center">
                      Status
                    </th>
                    <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-[#616c8a] text-center">
                      Risk Level
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#d0d5dd]/50">
                  {items.map((row) => (
                    <tr
                      key={row.id}
                      className="hover:bg-[#bde1f9]/20 transition-colors cursor-pointer"
                      onClick={() => navigate(`/expense/${row.id}`)}
                    >
                      <td className="px-6 py-4 text-sm font-semibold text-[#616c8a]">{formatDisplayDate(row.date || row.created_at)}</td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-full bg-[#bde1f9]/60 text-[#13426f] flex items-center justify-center">
                            <Icon name={categoryIcon(row.category)} className="text-base" />
                          </div>
                          <span className="text-sm font-bold text-[#13426f]">{row.merchant || "—"}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-sm font-semibold text-[#333333]">{row.category || "—"}</td>
                      <td className="px-6 py-4 text-sm font-extrabold text-[#13426f] text-right">{formatMoney(row.amount)}</td>
                      <td className="px-6 py-4 text-center">
                        <StatusBadge status={row.status} />
                      </td>
                      <td className="px-6 py-4 text-center">
                        <RiskBadge risk={row.risk_level} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </AppShell>
  );
}
