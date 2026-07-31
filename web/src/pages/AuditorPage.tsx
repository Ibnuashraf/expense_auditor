import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { AppShell } from "../components/AppShell";
import { RiskBadge, StatusBadge } from "../components/StatusBadge";
import { Icon } from "../components/Icon";
import { api, type Expense } from "../lib/api";
import { formatDisplayDate, formatMoney } from "../lib/format";

export function AuditorPage() {
  const [items, setItems] = useState<Expense[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const navigate = useNavigate();

  const load = useCallback(async () => {
    setErr(null);
    setLoading(true);
    try {
      const data = await api.expenses({ sort_by: "risk" });
      setItems(data);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Failed to load queue");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const violations = items.filter((e) => e.status === "flagged" || e.status === "rejected").length;
  const high = items.filter((e) => e.risk_level === "high").length;

  return (
    <AppShell
      title="Auditor Dashboard"
      subtitle="Review employee submissions by risk, then validate and finalize audit decisions."
      actions={
        <button
          type="button"
          onClick={() => load()}
          className="bg-[#2e96ff] text-white px-7 py-3 rounded-full font-bold text-sm shadow-[rgba(154,207,246,0.5)_0px_7px_0px_0px] hover:translate-y-[2px] transition-all flex items-center gap-2"
        >
          <Icon name="refresh" />
          Refresh Queue
        </button>
      }
    >
      <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-10">
        <div className="bg-white p-6 rounded-[22px] border border-[#d0d5dd] shadow-sm">
          <p className="text-xs font-bold uppercase tracking-wider text-[#616c8a] mb-2">Total In Queue</p>
          <h3 className="text-3xl font-extrabold text-[#13426f] font-headline">{items.length}</h3>
        </div>
        <div className="bg-white p-6 rounded-[22px] border border-[#d0d5dd] shadow-sm">
          <p className="text-xs font-bold uppercase tracking-wider text-[#616c8a] mb-2">High Risk Claims</p>
          <h3 className="text-3xl font-extrabold text-[#721c24] font-headline">{high}</h3>
        </div>
        <div className="bg-white p-6 rounded-[22px] border border-[#d0d5dd] shadow-sm">
          <p className="text-xs font-bold uppercase tracking-wider text-[#616c8a] mb-2">Flagged / Rejected</p>
          <h3 className="text-3xl font-extrabold text-[#856404] font-headline">{violations}</h3>
        </div>
        <div className="bg-[#13426f] text-white p-6 rounded-[22px] shadow-sm relative overflow-hidden">
          <p className="text-xs font-bold uppercase tracking-wider text-[#bde1f9]">RAG Policy Engine</p>
          <h3 className="text-2xl font-extrabold mt-2 text-white">Active & Guarded</h3>
          <Icon name="trending_up" className="absolute -bottom-3 -right-3 text-7xl text-[#2e96ff]/20" />
        </div>
      </section>

      {err && (
        <div className="rounded-2xl bg-[#f8d7da] text-[#721c24] border border-[#f5c6cb] px-5 py-3 text-sm font-bold mb-6">{err}</div>
      )}

      <div className="space-y-4">
        {loading ? (
          <p className="text-[#616c8a] font-semibold text-center p-8">Loading expense queue…</p>
        ) : (
          items.map((e) => (
            <button
              key={e.id}
              type="button"
              onClick={() => navigate(`/expense/${e.id}`)}
              className="w-full text-left bg-white p-6 rounded-[22px] border border-[#d0d5dd] shadow-sm hover:border-[#2e96ff] hover:shadow-md transition-all cursor-pointer"
            >
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="flex items-center gap-4 min-w-0">
                  <div className="w-12 h-12 rounded-full bg-[#bde1f9]/50 text-[#13426f] flex items-center justify-center shrink-0">
                    <Icon name="receipt_long" className="text-xl" />
                  </div>
                  <div className="min-w-0">
                    <h4 className="font-extrabold text-[#13426f] text-base truncate mb-1">
                      {e.merchant || `Expense #${e.id}`}
                    </h4>
                    <div className="flex flex-wrap items-center gap-3 text-xs font-semibold text-[#616c8a]">
                      <span className="flex items-center gap-1">
                        <Icon name="person" className="text-sm text-[#2e96ff]" /> User #{e.user_id ?? "—"}
                      </span>
                      <span>•</span>
                      <span>{formatDisplayDate(e.date || e.created_at)}</span>
                      <span>•</span>
                      <span className="truncate max-w-[180px]">{e.category || "—"}</span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-4 shrink-0 justify-between sm:justify-end border-t sm:border-t-0 pt-3 sm:pt-0 border-[#d0d5dd]/50">
                  <div className="text-right">
                    <span className="text-lg font-extrabold text-[#13426f] block">{formatMoney(e.amount)}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <StatusBadge status={e.status} />
                    <RiskBadge risk={e.risk_level} />
                  </div>
                </div>
              </div>
            </button>
          ))
        )}
      </div>
    </AppShell>
  );
}
