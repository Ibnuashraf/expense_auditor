import { useCallback, useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { AppShell } from "../components/AppShell";
import { Icon } from "../components/Icon";
import { RiskBadge, StatusBadge } from "../components/StatusBadge";
import { api, receiptImageUrl, type Expense } from "../lib/api";
import { formatDisplayDate, formatMoney } from "../lib/format";
import { useAuth } from "../context/AuthContext";

export function ExpenseDetailPage() {
  const { id } = useParams<{ id: string }>();
  const eid = Number(id);
  const { user } = useAuth();
  const navigate = useNavigate();
  const [expense, setExpense] = useState<Expense | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const isAuditor = user?.role === "auditor";
  const isOwner = user && expense?.user_id === user.user_id;

  const load = useCallback(async () => {
    if (!Number.isFinite(eid)) return;
    setErr(null);
    setLoading(true);
    try {
      const data = await api.expense(eid);
      setExpense(data);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Not found");
      setExpense(null);
    } finally {
      setLoading(false);
    }
  }, [eid]);

  useEffect(() => {
    load();
  }, [load]);

  const [purpose, setPurpose] = useState("");
  const [merchant, setMerchant] = useState("");
  const [amount, setAmount] = useState("");
  const [date, setDate] = useState("");

  useEffect(() => {
    if (!expense) return;
    setPurpose(expense.business_purpose || "");
    setMerchant(expense.merchant || "");
    setAmount(expense.amount != null ? String(expense.amount) : "");
    setDate(expense.date || "");
  }, [expense]);

  async function saveEdits() {
    if (!expense) return;
    setBusy(true);
    setErr(null);
    try {
      const updated = await api.patchExpense(expense.id, {
        merchant,
        amount: parseFloat(amount) || 0,
        date,
        business_purpose: purpose,
        ...(isAuditor
          ? {}
          : {
              status: undefined,
              explanation: undefined,
              risk_level: undefined,
            }),
      });
      setExpense(updated);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Update failed");
    } finally {
      setBusy(false);
    }
  }

  async function setStatus(status: "approved" | "rejected" | "flagged") {
    if (!expense || !isAuditor) return;
    setBusy(true);
    try {
      await api.patchExpense(expense.id, { status });
      navigate("/auditor", { replace: true });
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Failed");
    } finally {
      setBusy(false);
    }
  }

  async function reaudit() {
    if (!expense || !isAuditor) return;
    setBusy(true);
    try {
      await api.reaudit(expense.id);
      await load();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Re-audit failed");
    } finally {
      setBusy(false);
    }
  }

  async function onUploadFile(f: File | null) {
    if (!f || !expense) return;
    setBusy(true);
    setErr(null);
    try {
      await api.uploadReceipt(expense.id, f);
      await load();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Upload failed");
    } finally {
      setBusy(false);
    }
  }

  const imgUrl = receiptImageUrl(expense?.receipt_path);
  const isPdf = expense?.receipt_path?.toLowerCase().endsWith(".pdf");

  if (loading) {
    return (
      <AppShell title="Expense" subtitle="Loading…">
        <p className="text-secondary">Loading…</p>
      </AppShell>
    );
  }

  if (!expense) {
    return (
      <AppShell title="Expense" subtitle="Not found">
        <p className="text-error">{err || "Missing expense"}</p>
        <Link to="/dashboard" className="text-surface-tint font-semibold mt-4 inline-block">
          Back to dashboard
        </Link>
      </AppShell>
    );
  }

  return (
    <AppShell
      title={`Expense #${expense.id}`}
      subtitle={isAuditor ? `Employee user_id ${expense.user_id ?? "—"}` : "Your submission"}
      actions={
        <div className="flex flex-wrap gap-2">
          {isAuditor && (
            <>
              <button
                type="button"
                disabled={busy}
                onClick={() => setStatus("flagged")}
                className="px-4 py-2 bg-surface-container-high font-bold text-sm rounded-md transition-opacity duration-200 hover:opacity-80 disabled:opacity-50"
              >
                Flag
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={() => setStatus("rejected")}
                className="px-4 py-2 bg-error text-on-error font-bold text-sm rounded-md transition-opacity duration-200 hover:opacity-80 disabled:opacity-50"
              >
                Reject
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={() => setStatus("approved")}
                className="px-6 py-2 bg-green-600 hover:bg-green-700 text-white font-bold text-sm rounded-md shadow-sm transition-opacity duration-200 hover:opacity-90 disabled:opacity-50"
              >
                Approve
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={() => reaudit()}
                className="px-4 py-2 border border-surface-tint text-surface-tint font-bold text-sm rounded-md transition-opacity duration-200 hover:opacity-80 disabled:opacity-50"
              >
                Re-run audit
              </button>
            </>
          )}
        </div>
      }
    >
      {err && (
        <div className="mb-6 rounded-lg bg-error-container/50 text-on-error-container px-4 py-3 text-sm">{err}</div>
      )}

      <div className="mb-6">
        <button
          type="button"
          onClick={() => navigate(isAuditor ? "/auditor" : "/dashboard")}
          className="inline-flex items-center text-surface-tint font-semibold text-sm"
        >
          <Icon name="arrow_back" className="text-sm mr-1" /> Back
        </button>
      </div>

      <div className="grid grid-cols-12 gap-6">
        <section className="col-span-12 lg:col-span-4 bg-surface-container-low rounded-xl overflow-hidden min-h-[320px] relative">
          {imgUrl && !isPdf && (
            <img src={imgUrl} alt="Receipt" className="w-full h-full object-contain bg-slate-200/50 max-h-[480px]" />
          )}
          {imgUrl && isPdf && (
            <div className="p-6 flex flex-col items-center justify-center min-h-[280px] gap-4">
              <Icon name="picture_as_pdf" className="text-5xl text-secondary" />
              <a href={imgUrl} target="_blank" rel="noreferrer" className="text-surface-tint font-bold underline">
                Open PDF receipt
              </a>
            </div>
          )}
          {!imgUrl && (
            <div className="p-8 text-center text-secondary text-sm">No receipt uploaded yet.</div>
          )}
          {isOwner && (
            <div className="p-4 border-t border-surface-container bg-surface-container-lowest">
              <label className="block text-xs font-bold text-secondary uppercase mb-2">Upload / replace receipt</label>
              <input
                type="file"
                accept="image/*,.pdf"
                disabled={busy || !isOwner}
                onChange={(e) => onUploadFile(e.target.files?.[0] || null)}
                className="text-sm w-full"
              />
            </div>
          )}
        </section>

        <section className="col-span-12 lg:col-span-4 flex flex-col gap-6">
          <div className="bg-surface-container-lowest p-6 rounded-xl custom-shadow">
            <h3 className="text-xs font-bold uppercase tracking-widest text-secondary mb-6">Expense overview</h3>
            <div className="space-y-6">
              <div>
                <label className="text-[10px] font-bold text-slate-400 uppercase block mb-1">Merchant</label>
                {isOwner ? (
                  <input
                    className="w-full text-xl font-extrabold bg-surface-container-high px-3 py-2 rounded-lg outline-none"
                    value={merchant}
                    onChange={(e) => setMerchant(e.target.value)}
                  />
                ) : (
                  <p className="text-2xl font-extrabold">{expense.merchant || "—"}</p>
                )}
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-[10px] font-bold text-slate-400 uppercase block mb-1">Amount</label>
                  {isOwner ? (
                    <input
                      className="w-full text-lg font-bold bg-surface-container-high px-3 py-2 rounded-lg outline-none"
                      type="number"
                      step="0.01"
                      value={amount}
                      onChange={(e) => setAmount(e.target.value)}
                    />
                  ) : (
                    <p className="text-xl font-bold">{formatMoney(expense.amount)}</p>
                  )}
                </div>
                <div>
                  <label className="text-[10px] font-bold text-slate-400 uppercase block mb-1">Date</label>
                  {isOwner ? (
                    <input
                      className="w-full text-lg font-bold bg-surface-container-high px-3 py-2 rounded-lg outline-none"
                      value={date}
                      onChange={(e) => setDate(e.target.value)}
                    />
                  ) : (
                    <p className="text-xl font-bold">{formatDisplayDate(expense.date)}</p>
                  )}
                </div>
              </div>
              <div>
                <label className="text-[10px] font-bold text-slate-400 uppercase block mb-1">Business purpose</label>
                <textarea
                  className="w-full bg-surface-container p-4 rounded-lg text-sm leading-relaxed outline-none min-h-[100px]"
                  value={purpose}
                  onChange={(e) => setPurpose(e.target.value)}
                  disabled={!isOwner}
                />
              </div>
              <div className="flex flex-wrap gap-3 items-center">
                <span className="text-[10px] font-bold text-slate-400 uppercase">Status</span>
                <StatusBadge status={expense.status} />
                <RiskBadge risk={expense.risk_level} />
              </div>
              {isOwner && (
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => saveEdits()}
                  className="w-full py-3 bg-primary text-on-primary rounded-lg font-bold disabled:opacity-50 transition-opacity duration-200 hover:opacity-90"
                >
                  Start Audit
                </button>
              )}
            </div>
          </div>
          {isAuditor && (
            <div className="bg-surface-container-lowest p-6 rounded-xl custom-shadow">
              <h3 className="text-xs font-bold uppercase tracking-widest text-secondary mb-4">OCR extracted details</h3>
              <div className="space-y-2 text-sm text-on-surface-variant">
                <p>
                  <span className="font-semibold text-on-surface">Merchant:</span>{" "}
                  {expense.ocr_merchant || "Not extracted"}
                </p>
                <p>
                  <span className="font-semibold text-on-surface">Amount:</span>{" "}
                  {expense.ocr_amount != null ? formatMoney(expense.ocr_amount) : "Not extracted"}
                </p>
                <p>
                  <span className="font-semibold text-on-surface">Date:</span>{" "}
                  {expense.ocr_date || "Not extracted"}
                </p>
              </div>
            </div>
          )}
        </section>

        <section className="col-span-12 lg:col-span-4 flex flex-col gap-6">
          <div className="bg-tertiary-container p-6 rounded-xl border-l-4 border-surface-tint text-on-tertiary-container">
            <h3 className="text-xs font-black uppercase tracking-widest mb-2 opacity-90">Audit risk</h3>
            <p className="text-2xl font-extrabold text-tertiary-fixed capitalize">{expense.risk_level || "pending"}</p>
          </div>
          <div className="bg-surface-container-lowest p-6 rounded-xl custom-shadow flex-1">
            <div className="flex items-center gap-2 mb-4">
              <Icon name="auto_awesome" className="text-primary-container" />
              <h3 className="text-sm font-bold">Policy insights</h3>
            </div>
            <p className="text-sm text-on-surface leading-relaxed whitespace-pre-wrap">{expense.explanation || "—"}</p>
            {expense.policy_rule && (
              <p className="mt-4 text-xs font-bold text-surface-tint">Rule: {expense.policy_rule}</p>
            )}
            <div className="mt-6 pt-6 border-t border-surface-container">
              <p className="text-[10px] font-black uppercase text-on-surface-variant mb-2">RAG / policy reference</p>
              <p className="text-xs text-on-surface-variant leading-relaxed max-h-48 overflow-y-auto">
                {expense.policy_reference || "—"}
              </p>
            </div>
          </div>
        </section>
      </div>
    </AppShell>
  );
}
