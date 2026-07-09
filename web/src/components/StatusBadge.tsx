import type { Expense } from "../lib/api";

function statusClass(status: string) {
  switch (status) {
    case "approved":
      return "bg-primary-fixed text-on-primary-fixed";
    case "pending":
      return "bg-surface-container-highest text-on-surface-variant";
    case "flagged":
      return "bg-tertiary-fixed text-on-tertiary-container";
    case "rejected":
      return "bg-error-container text-on-error-container";
    default:
      return "bg-surface-container-high text-on-surface-variant";
  }
}

function riskClass(risk: string | null | undefined) {
  switch (risk) {
    case "low":
      return "bg-secondary-container text-on-secondary-container";
    case "medium":
      return "bg-tertiary-fixed text-on-tertiary-container";
    case "high":
      return "bg-error-container text-on-error-container";
    default:
      return "bg-surface-container-high text-on-surface-variant";
  }
}

export function StatusBadge({ status }: { status: string }) {
  return (
    <span
      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold capitalize ${statusClass(status)}`}
    >
      {status}
    </span>
  );
}

export function RiskBadge({ risk }: { risk: Expense["risk_level"] }) {
  const label = risk === "pending" || !risk ? "—" : risk;
  return (
    <span
      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold capitalize ${riskClass(risk)}`}
    >
      {label}
    </span>
  );
}
