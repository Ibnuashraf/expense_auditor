export function formatMoney(n: number | null | undefined): string {
  if (n == null || Number.isNaN(n)) return "—";
  return new Intl.NumberFormat(undefined, {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 2,
  }).format(n);
}

export function formatDisplayDate(isoOrStr: string | null | undefined): string {
  if (!isoOrStr) return "—";
  const d = new Date(isoOrStr);
  if (!Number.isNaN(d.getTime()) && isoOrStr.includes("T")) {
    return d.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
  }
  return isoOrStr;
}
