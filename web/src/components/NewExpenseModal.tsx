import { useState } from "react";
import { api } from "../lib/api";
import { Icon } from "./Icon";

export function NewExpenseModal({
  open,
  onClose,
  onCreated,
}: {
  open: boolean;
  onClose: () => void;
  onCreated: (id: number) => void;
}) {
  const [merchant, setMerchant] = useState("");
  const [amount, setAmount] = useState("");
  const [date, setDate] = useState("");
  const [category, setCategory] = useState("");
  const [businessPurpose, setBusinessPurpose] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!open) return null;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!merchant.trim() || !amount || !date.trim() || !category.trim() || !businessPurpose.trim()) {
      setError("All fields are mandatory, including business purpose.");
      return;
    }
    if (!file) {
      setError("A receipt file is strictly required to submit an expense.");
      return;
    }
    setLoading(true);
    try {
      const exp = await api.createExpense({
        merchant,
        amount: parseFloat(amount) || 0,
        date,
        category,
        business_purpose: businessPurpose,
      });
      if (file && exp.id) {
        await api.uploadReceipt(exp.id, file);
      }
      onCreated(exp.id);
      onClose();
      setMerchant("");
      setAmount("");
      setDate("");
      setCategory("");
      setBusinessPurpose("");
      setFile(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/50 backdrop-blur-md transition-all duration-300">
      <div className="bg-surface-container-lowest rounded-xl shadow-2xl max-w-lg w-full max-h-[90vh] overflow-y-auto p-6 animate-in zoom-in-95 duration-300">
        <div className="flex justify-between items-start mb-6">
          <div>
            <h2 className="text-xl font-bold font-[family-name:var(--font-headline)]">New expense</h2>
            <p className="text-sm text-on-surface-variant mt-1">Create a claim, then attach a receipt to run policy audit. A receipt is mandatory.</p>
          </div>
          <button type="button" onClick={onClose} className="p-2 rounded-lg hover:bg-surface-container-high transition-colors">
            <Icon name="close" />
          </button>
        </div>
        <form className="space-y-4" onSubmit={submit}>
          {error && (
            <div className="text-sm text-on-error-container bg-error-container/30 rounded-lg px-3 py-2">{error}</div>
          )}
          <input
            className="w-full px-4 py-3 rounded-lg bg-surface-container-high outline-none focus:ring-2 ring-surface-tint/30"
            placeholder="Merchant"
            value={merchant}
            onChange={(e) => setMerchant(e.target.value)}
            required
          />
          <div className="grid grid-cols-2 gap-3">
            <input
              className="w-full px-4 py-3 rounded-lg bg-surface-container-high outline-none"
              placeholder="Amount"
              type="number"
              step="0.01"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              required
            />
            <input
              className="w-full px-4 py-3 rounded-lg bg-surface-container-high outline-none"
              placeholder="Date (DD/MM/YYYY)"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              required
            />
          </div>
          <input
            className="w-full px-4 py-3 rounded-lg bg-surface-container-high outline-none"
            placeholder="Category"
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            required
          />
          <textarea
            className="w-full px-4 py-3 rounded-lg bg-surface-container-high outline-none min-h-[100px] text-sm"
            placeholder="Business purpose (10+ words recommended)"
            value={businessPurpose}
            onChange={(e) => setBusinessPurpose(e.target.value)}
            required
          />
          <div>
            <label className="block text-xs font-bold text-secondary uppercase mb-2">Receipt <span className="text-error">*</span></label>
            <input
              type="file"
              accept="image/*,.pdf"
              onChange={(e) => setFile(e.target.files?.[0] || null)}
              className="text-sm w-full file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-primary-container file:text-on-primary-container hover:file:bg-primary/20 transition-all cursor-pointer"
            />
            {file && <p className="text-xs text-surface-tint mt-1">{file.name}</p>}
          </div>
          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose} className="flex-1 py-3 rounded-lg bg-surface-container-high font-semibold">
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 py-3 rounded-lg bg-primary text-on-primary font-bold disabled:opacity-50"
            >
              {loading ? "Saving…" : "Submit"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
