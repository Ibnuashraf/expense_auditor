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
      <AppShell title="Expense Details" subtitle="Loading claim specifications…">
        <p className="text-[#616c8a] font-semibold p-8 text-center">Loading details…</p>
      </AppShell>
    );
  }

  if (!expense) {
    return (
      <AppShell title="Expense Details" subtitle="Not found">
        <p className="text-[#721c24] font-bold">{err || "Missing expense claim"}</p>
        <Link to="/dashboard" className="text-[#2e96ff] font-bold mt-4 inline-block">
          ← Back to dashboard
        </Link>
      </AppShell>
    );
  }

  return (
    <AppShell
      title={`Claim #${expense.id}`}
      subtitle={isAuditor ? `Submitted by User #${expense.user_id ?? "—"}` : "Your expense claim details"}
      actions={
        <div className="flex flex-wrap gap-3">
          {isAuditor && (
            <>
              <button
                type="button"
                disabled={busy}
                onClick={() => setStatus("flagged")}
                className="px-5 py-2.5 bg-[#fff3cd] text-[#856404] font-extrabold text-sm rounded-full border border-[#ffebaba0] hover:opacity-90 disabled:opacity-50"
              >
                Flag
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={() => setStatus("rejected")}
                className="px-5 py-2.5 bg-[#f8d7da] text-[#721c24] font-extrabold text-sm rounded-full border border-[#f5c6cb] hover:opacity-90 disabled:opacity-50"
              >
                Reject
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={() => setStatus("approved")}
                className="px-6 py-2.5 bg-[#2e96ff] text-white font-extrabold text-sm rounded-full shadow-[rgba(154,207,246,0.5)_0px_5px_0px_0px] hover:translate-y-[2px] disabled:opacity-50"
              >
                Approve Claim
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={() => reaudit()}
                className="px-5 py-2.5 bg-white text-[#13426f] border border-[#d0d5dd] font-extrabold text-sm rounded-full hover:border-[#2e96ff] disabled:opacity-50"
              >
                Re-run Audit
              </button>
            </>
          )}
        </div>
      }
    >
      {err && (
        <div className="mb-6 rounded-2xl bg-[#f8d7da] text-[#721c24] border border-[#f5c6cb] px-5 py-3 text-sm font-bold">{err}</div>
      )}

      <div className="mb-6">
        <button
          type="button"
          onClick={() => navigate(isAuditor ? "/auditor" : "/dashboard")}
          className="inline-flex items-center text-[#2e96ff] font-bold text-sm hover:underline"
        >
          <Icon name="arrow_back" className="text-base mr-1" /> Back to Dashboard
        </button>
      </div>

      <div className="grid grid-cols-12 gap-6">
        {/* Receipt Panel */}
        <section className="col-span-12 lg:col-span-4 bg-white rounded-[22px] border border-[#d0d5dd] overflow-hidden min-h-[320px] relative shadow-sm flex flex-col justify-between">
          <div>
            <div className="p-4 bg-[#f9f7f0] border-b border-[#d0d5dd]">
              <h3 className="text-xs font-bold uppercase tracking-wider text-[#616c8a]">Receipt Image</h3>
            </div>
            {imgUrl && !isPdf && (
              <img src={imgUrl} alt="Receipt" className="w-full object-contain p-4 bg-white max-h-[460px]" />
            )}
            {imgUrl && isPdf && (
              <div className="p-8 flex flex-col items-center justify-center min-h-[260px] gap-4">
                <Icon name="picture_as_pdf" className="text-6xl text-[#13426f]" />
                <a href={imgUrl} target="_blank" rel="noreferrer" className="text-[#2e96ff] font-extrabold underline text-sm">
                  View Uploaded PDF Receipt
                </a>
              </div>
            )}
            {!imgUrl && (
              <div className="p-12 text-center text-[#616c8a] font-semibold text-sm">No receipt image attached yet.</div>
            )}
          </div>
          {isOwner && (
            <div className="p-5 border-t border-[#d0d5dd] bg-[#f9f7f0]">
              <label className="block text-xs font-bold text-[#616c8a] uppercase mb-2">Upload / Replace Receipt</label>
              <input
                type="file"
                accept="image/*,.pdf"
                disabled={busy || !isOwner}
                onChange={(e) => onUploadFile(e.target.files?.[0] || null)}
                className="text-xs text-[#333333] file:mr-3 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-xs file:font-bold file:bg-[#bde1f9] file:text-[#13426f] hover:file:bg-[#2e96ff] hover:file:text-white file:transition-all"
              />
            </div>
          )}
        </section>

        {/* Overview & Form */}
        <section className="col-span-12 lg:col-span-4 flex flex-col gap-6">
          <div className="bg-white p-7 rounded-[22px] border border-[#d0d5dd] shadow-sm">
            <h3 className="text-xs font-bold uppercase tracking-wider text-[#616c8a] mb-6">Claim Parameters</h3>
            <div className="space-y-5">
              <div>
                <label className="text-xs font-bold text-[#616c8a] uppercase block mb-1">Merchant</label>
                {isOwner ? (
                  <input
                    className="w-full text-lg font-bold bg-[#f9f7f0] border border-[#d0d5dd] px-4 py-2.5 rounded-full outline-none focus:ring-2 focus:ring-[#2e96ff] text-[#13426f]"
                    value={merchant}
                    onChange={(e) => setMerchant(e.target.value)}
                  />
                ) : (
                  <p className="text-2xl font-extrabold text-[#13426f]">{expense.merchant || "—"}</p>
                )}
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-bold text-[#616c8a] uppercase block mb-1">Amount</label>
                  {isOwner ? (
                    <input
                      className="w-full text-base font-bold bg-[#f9f7f0] border border-[#d0d5dd] px-4 py-2.5 rounded-full outline-none focus:ring-2 focus:ring-[#2e96ff] text-[#13426f]"
                      type="number"
                      step="0.01"
                      value={amount}
                      onChange={(e) => setAmount(e.target.value)}
                    />
                  ) : (
                    <p className="text-xl font-extrabold text-[#13426f]">{formatMoney(expense.amount)}</p>
                  )}
                </div>
                <div>
                  <label className="text-xs font-bold text-[#616c8a] uppercase block mb-1">Date</label>
                  {isOwner ? (
                    <input
                      className="w-full text-base font-bold bg-[#f9f7f0] border border-[#d0d5dd] px-4 py-2.5 rounded-full outline-none focus:ring-2 focus:ring-[#2e96ff] text-[#13426f]"
                      value={date}
                      onChange={(e) => setDate(e.target.value)}
                    />
                  ) : (
                    <p className="text-xl font-extrabold text-[#13426f]">{formatDisplayDate(expense.date)}</p>
                  )}
                </div>
              </div>
              <div>
                <label className="text-xs font-bold text-[#616c8a] uppercase block mb-1">Business Purpose</label>
                <textarea
                  className="w-full bg-[#f9f7f0] border border-[#d0d5dd] p-4 rounded-2xl text-sm font-medium outline-none focus:ring-2 focus:ring-[#2e96ff] text-[#333333] min-h-[90px]"
                  value={purpose}
                  onChange={(e) => setPurpose(e.target.value)}
                  disabled={!isOwner}
                />
              </div>
              <div className="flex flex-wrap gap-3 items-center pt-2">
                <StatusBadge status={expense.status} />
                <RiskBadge risk={expense.risk_level} />
              </div>
              {isOwner && (
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => saveEdits()}
                  className="w-full py-3.5 bg-[#2e96ff] text-white rounded-full font-extrabold text-sm shadow-[rgba(154,207,246,0.5)_0px_7px_0px_0px] hover:translate-y-[2px] transition-all"
                >
                  Start Audit
                </button>
              )}
            </div>
          </div>

          {isAuditor && (
            <div className="bg-white p-6 rounded-[22px] border border-[#d0d5dd] shadow-sm">
              <h3 className="text-xs font-bold uppercase tracking-wider text-[#616c8a] mb-4">OCR Extracted Details</h3>
              <div className="space-y-2 text-sm text-[#333333]">
                <p>
                  <span className="font-bold text-[#13426f]">Merchant:</span>{" "}
                  {expense.ocr_merchant || "Not extracted"}
                </p>
                <p>
                  <span className="font-bold text-[#13426f]">Amount:</span>{" "}
                  {expense.ocr_amount != null ? formatMoney(expense.ocr_amount) : "Not extracted"}
                </p>
                <p>
                  <span className="font-bold text-[#13426f]">Date:</span>{" "}
                  {expense.ocr_date || "Not extracted"}
                </p>
              </div>
            </div>
          )}
        </section>

        {/* Policy & RAG Insights */}
        <section className="col-span-12 lg:col-span-4 flex flex-col gap-6">
          <div className="bg-[#13426f] text-white p-7 rounded-[22px] shadow-sm">
            <h3 className="text-xs font-bold uppercase tracking-wider text-[#bde1f9] mb-2">Audit Risk Score</h3>
            <p className="text-3xl font-extrabold text-white capitalize font-headline">{expense.risk_level || "pending"}</p>
          </div>

          <div className="bg-white p-7 rounded-[22px] border border-[#d0d5dd] shadow-sm flex-1">
            <div className="flex items-center gap-2 mb-4">
              <Icon name="auto_awesome" className="text-[#2e96ff] text-xl" />
              <h3 className="text-base font-extrabold text-[#13426f]">Policy Insights</h3>
            </div>
            <p className="text-sm text-[#333333] leading-relaxed whitespace-pre-wrap font-medium">{expense.explanation || "—"}</p>
            {expense.policy_rule && (
              <div className="mt-4 inline-block px-3 py-1 rounded-full bg-[#bde1f9] text-[#13426f] text-xs font-extrabold">
                Rule: {expense.policy_rule}
              </div>
            )}
            <div className="mt-6 pt-6 border-t border-[#d0d5dd]">
              <p className="text-xs font-bold uppercase text-[#616c8a] mb-2">RAG Policy Evidence</p>
              <p className="text-xs text-[#616c8a] leading-relaxed max-h-48 overflow-y-auto bg-[#f9f7f0] p-4 rounded-xl border border-[#d0d5dd]">
                {expense.policy_reference || "—"}
              </p>
            </div>
          </div>
        </section>
      </div>
    </AppShell>
  );
}
