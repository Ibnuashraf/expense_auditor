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
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-[#13426f]/40 backdrop-blur-sm transition-all duration-300">
      <div className="bg-white rounded-[26px] border border-[#d0d5dd] shadow-2xl max-w-lg w-full max-h-[90vh] overflow-y-auto p-8">
        <div className="flex justify-between items-start mb-6">
          <div>
            <h2 className="text-2xl font-extrabold text-[#13426f] font-headline">New Expense Claim</h2>
            <p className="text-xs text-[#616c8a] mt-1 font-semibold">Attach a receipt to trigger automatic OCR policy evaluation.</p>
          </div>
          <button type="button" onClick={onClose} className="p-2.5 rounded-full hover:bg-[#bde1f9]/40 text-[#13426f] transition-all">
            <Icon name="close" />
          </button>
        </div>
        <form className="space-y-4" onSubmit={submit}>
          {error && (
            <div className="text-xs font-bold text-[#721c24] bg-[#f8d7da] border border-[#f5c6cb] rounded-2xl px-4 py-3">{error}</div>
          )}
          <div>
            <label className="block text-xs font-bold text-[#616c8a] uppercase mb-1">Merchant</label>
            <input
              className="w-full px-5 py-3 rounded-full bg-[#f9f7f0] border border-[#d0d5dd] text-sm font-semibold outline-none focus:ring-2 focus:ring-[#2e96ff] text-[#333333]"
              placeholder="e.g. Starbucks, Hilton, Uber"
              value={merchant}
              onChange={(e) => setMerchant(e.target.value)}
              required
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-[#616c8a] uppercase mb-1">Amount</label>
              <input
                className="w-full px-5 py-3 rounded-full bg-[#f9f7f0] border border-[#d0d5dd] text-sm font-semibold outline-none focus:ring-2 focus:ring-[#2e96ff] text-[#333333]"
                placeholder="Amount (INR/USD)"
                type="number"
                step="0.01"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                required
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-[#616c8a] uppercase mb-1">Date</label>
              <input
                className="w-full px-5 py-3 rounded-full bg-[#f9f7f0] border border-[#d0d5dd] text-sm font-semibold outline-none focus:ring-2 focus:ring-[#2e96ff] text-[#333333]"
                placeholder="DD/MM/YYYY"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                required
              />
            </div>
          </div>
          <div>
            <label className="block text-xs font-bold text-[#616c8a] uppercase mb-1">Category</label>
            <input
              className="w-full px-5 py-3 rounded-full bg-[#f9f7f0] border border-[#d0d5dd] text-sm font-semibold outline-none focus:ring-2 focus:ring-[#2e96ff] text-[#333333]"
              placeholder="Meals, Lodging, Transport, Entertainment"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              required
            />
          </div>
          <div>
            <label className="block text-xs font-bold text-[#616c8a] uppercase mb-1">Business Purpose</label>
            <textarea
              className="w-full px-5 py-3.5 rounded-2xl bg-[#f9f7f0] border border-[#d0d5dd] text-sm font-medium outline-none focus:ring-2 focus:ring-[#2e96ff] text-[#333333] min-h-[90px]"
              placeholder="Detailed explanation of business rationale"
              value={businessPurpose}
              onChange={(e) => setBusinessPurpose(e.target.value)}
              required
            />
          </div>
          <div>
            <label className="block text-xs font-bold text-[#616c8a] uppercase mb-2">Receipt Document <span className="text-[#721c24]">*</span></label>
            <input
              type="file"
              accept="image/*,.pdf"
              onChange={(e) => setFile(e.target.files?.[0] || null)}
              className="text-xs text-[#333333] w-full file:mr-4 file:py-2.5 file:px-5 file:rounded-full file:border-0 file:text-xs file:font-bold file:bg-[#bde1f9] file:text-[#13426f] hover:file:bg-[#2e96ff] hover:file:text-white file:transition-all cursor-pointer"
            />
            {file && <p className="text-xs text-[#2e96ff] font-bold mt-1.5">{file.name}</p>}
          </div>
          <div className="flex gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-3.5 rounded-full bg-white border border-[#d0d5dd] font-extrabold text-sm text-[#13426f] hover:bg-[#f9f7f0]"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 py-3.5 rounded-full bg-[#2e96ff] text-white font-extrabold text-sm shadow-[rgba(154,207,246,0.5)_0px_7px_0px_0px] hover:translate-y-[2px] disabled:opacity-50"
            >
              {loading ? "Creating..." : "Submit Claim"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
