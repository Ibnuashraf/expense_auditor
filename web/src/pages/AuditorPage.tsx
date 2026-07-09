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
          className="px-6 py-3 bg-surface-container-high rounded-lg font-semibold hover:bg-surface-dim transition-opacity duration-200 hover:opacity-90 animate-in slide-in-from-right fade-in"
        >
          Refresh
        </button>
      }
    >
      <section className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-10 animate-in slide-in-from-bottom-4 fade-in duration-500">
        <div className="bg-surface-container-lowest p-6 rounded-xl custom-shadow hover:scale-[1.02] transition-transform">
          <p className="text-[10px] font-bold uppercase tracking-widest text-secondary mb-2">In queue</p>
          <h3 className="text-3xl font-extrabold font-[family-name:var(--font-headline)]">{items.length}</h3>
        </div>
        <div className="bg-surface-container-lowest p-6 rounded-xl custom-shadow hover:scale-[1.02] transition-transform">
          <p className="text-[10px] font-bold uppercase tracking-widest text-secondary mb-2">High risk</p>
          <h3 className="text-3xl font-extrabold font-[family-name:var(--font-headline)]">{high}</h3>
        </div>
        <div className="bg-surface-container-lowest p-6 rounded-xl custom-shadow hover:scale-[1.02] transition-transform">
          <p className="text-[10px] font-bold uppercase tracking-widest text-secondary mb-2">Flagged / rejected</p>
          <h3 className="text-3xl font-extrabold font-[family-name:var(--font-headline)]">{violations}</h3>
        </div>
        <div className="bg-primary-container p-6 rounded-xl custom-shadow text-on-primary-fixed relative overflow-hidden">
          <p className="text-[10px] uppercase tracking-widest font-bold opacity-80">Policy engine</p>
          <h3 className="text-2xl font-extrabold mt-2">Live</h3>
          <Icon name="trending_up" className="absolute -bottom-2 -right-2 text-8xl opacity-10" />
        </div>
      </section>

      {err && (
        <div className="rounded-lg bg-error-container/50 text-on-error-container px-4 py-3 text-sm mb-6">{err}</div>
      )}

      <div className="space-y-4">
        {loading ? (
          <p className="text-secondary">Loading queue…</p>
        ) : (
          items.map((e) => (
            <button
              key={e.id}
              type="button"
              onClick={() => navigate(`/expense/${e.id}`)}
              className="w-full text-left group bg-surface-container-lowest p-5 rounded-xl transition-all duration-200 hover:ring-2 hover:ring-primary-fixed cursor-pointer"
            >
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-lg bg-surface-container-low flex items-center justify-center">
                  <Icon name="receipt_long" className="text-secondary" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2 mb-1">
                    <h4 className="font-bold text-on-surface truncate">{e.merchant || `Expense #${e.id}`}</h4>
                    <span className="text-sm font-bold text-on-surface shrink-0">{formatMoney(e.amount)}</span>
                  </div>
                  <div className="flex flex-wrap items-center gap-3 text-xs font-medium text-on-surface-variant">
                    <span className="flex items-center gap-1">
                      <Icon name="person" className="text-[14px]" /> User #{e.user_id ?? "—"}
                    </span>
                    <span>{formatDisplayDate(e.date || e.created_at)}</span>
                    <span className="truncate max-w-[200px]">{e.category || "—"}</span>
                  </div>
                </div>
                <div className="flex flex-col items-end gap-2 shrink-0">
                  <StatusBadge status={e.status} />
                  <RiskBadge risk={e.risk_level} />
                </div>
              </div>
            </button>
          ))
        )}
      </div>
    </AppShell>
  );
}
