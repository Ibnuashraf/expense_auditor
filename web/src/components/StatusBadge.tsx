import type { Expense } from "../lib/api";

function statusClass(status: string) {
  switch (status) {
    case "approved":
      return "bg-[#bde1f9] text-[#13426f] border border-[#2e96ff]/30";
    case "pending":
      return "bg-[#ffffff] text-[#616c8a] border border-[#d0d5dd]";
    case "flagged":
      return "bg-[#fff3cd] text-[#856404] border border-[#ffebaba0]";
    case "rejected":
      return "bg-[#f8d7da] text-[#721c24] border border-[#f5c6cb]";
    default:
      return "bg-[#ffffff] text-[#616c8a] border border-[#d0d5dd]";
  }
}

function riskClass(risk: string | null | undefined) {
  switch (risk) {
    case "low":
      return "bg-[#bde1f9] text-[#13426f]";
    case "medium":
      return "bg-[#fff3cd] text-[#856404]";
    case "high":
      return "bg-[#f8d7da] text-[#721c24]";
    default:
      return "bg-[#ffffff] text-[#616c8a]";
  }
}

export function StatusBadge({ status }: { status: string }) {
  return (
    <span
      className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-extrabold capitalize ${statusClass(status)}`}
    >
      {status}
    </span>
  );
}

export function RiskBadge({ risk }: { risk: Expense["risk_level"] }) {
  const label = risk === "pending" || !risk ? "—" : risk;
  return (
    <span
      className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-extrabold capitalize ${riskClass(risk)}`}
    >
      {label}
    </span>
  );
}
