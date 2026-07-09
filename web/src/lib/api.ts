import { API_BASE } from "./config";

const TOKEN_KEY = "auditra_token";
const USER_KEY = "auditra_user";

export interface LoginBody {
  username: string;
  password: string;
}

export interface TokenResponse {
  access_token: string;
  token_type: string;
  role: string;
  grade: string;
  username: string;
  user_id: number;
}

export interface User {
  id: number;
  username: string;
  email: string;
  role: string;
  grade: string;
  created_at: string;
}

export interface Expense {
  id: number;
  merchant: string | null;
  amount: number | null;
  date: string | null;
  category: string | null;
  business_purpose: string | null;
  status: string;
  receipt_path: string | null;
  explanation: string | null;
  risk_level: string | null;
  policy_rule: string | null;
  policy_reference: string | null;
  ocr_merchant: string | null;
  ocr_amount: number | null;
  ocr_date: string | null;
  user_id: number | null;
  created_at: string | null;
}

export interface ExpenseCreate {
  merchant?: string;
  amount?: number;
  date?: string;
  category?: string;
  business_purpose?: string;
}

export interface ExpenseUpdate {
  merchant?: string | null;
  amount?: number | null;
  date?: string | null;
  category?: string | null;
  business_purpose?: string | null;
  status?: string | null;
  explanation?: string | null;
  risk_level?: string | null;
}

export interface RegisterBody {
  username: string;
  email: string;
  password: string;
  role: "employee" | "auditor";
  grade?: string;
}

function getToken(): string | null {
  return sessionStorage.getItem(TOKEN_KEY);
}

export function setSession(token: string, user: TokenResponse): void {
  sessionStorage.setItem(TOKEN_KEY, token);
  sessionStorage.setItem(USER_KEY, JSON.stringify(user));
}

export function clearSession(): void {
  sessionStorage.removeItem(TOKEN_KEY);
  sessionStorage.removeItem(USER_KEY);
}

export function getStoredUser(): TokenResponse | null {
  const raw = sessionStorage.getItem(USER_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as TokenResponse;
  } catch {
    return null;
  }
}

async function request<T>(
  path: string,
  options: RequestInit & { token?: string | null } = {}
): Promise<T> {
  const { token = getToken(), ...init } = options;
  const headers = new Headers(init.headers);
  if (!headers.has("Content-Type") && init.body && typeof init.body === "string") {
    headers.set("Content-Type", "application/json");
  }
  if (token) {
    headers.set("Authorization", `Bearer ${token}`);
  }
  const res = await fetch(`${API_BASE}${path}`, { ...init, headers });
  if (!res.ok) {
    let detail = res.statusText;
    try {
      const j = (await res.json()) as { detail?: string | string[] };
      if (typeof j.detail === "string") detail = j.detail;
      else if (Array.isArray(j.detail)) detail = j.detail.map((d) => String(d)).join(", ");
    } catch {
      /* ignore */
    }
    throw new Error(detail || `HTTP ${res.status}`);
  }
  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}

export const api = {
  login: (body: LoginBody) =>
    request<TokenResponse>("/auth/login", {
      method: "POST",
      body: JSON.stringify(body),
      token: null,
    }),

  register: (body: RegisterBody) =>
    request<User>("/auth/register", {
      method: "POST",
      body: JSON.stringify(body),
      token: null,
    }),

  me: () => request<User>("/auth/me"),

  expenses: (params?: {
    status?: string;
    category?: string;
    search?: string;
    sort_by?: string;
    mine?: boolean;
  }) => {
    const q = new URLSearchParams();
    if (params?.status) q.set("status", params.status);
    if (params?.category) q.set("category", params.category);
    if (params?.search) q.set("search", params.search);
    if (params?.sort_by) q.set("sort_by", params.sort_by);
    if (params?.mine !== undefined) q.set("mine", String(params.mine));
    const qs = q.toString();
    return request<Expense[]>(`/expenses${qs ? `?${qs}` : ""}`);
  },

  expense: (id: number) => request<Expense>(`/expense/${id}`),

  createExpense: (body: ExpenseCreate) =>
    request<Expense>("/expense", { method: "POST", body: JSON.stringify(body) }),

  patchExpense: (id: number, body: ExpenseUpdate) =>
    request<Expense>(`/expense/${id}`, {
      method: "PATCH",
      body: JSON.stringify(body),
    }),

  uploadReceipt: (expenseId: number, file: File) => {
    const fd = new FormData();
    fd.append("file", file);
    const token = getToken();
    return fetch(`${API_BASE}/upload/${expenseId}`, {
      method: "POST",
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      body: fd,
    }).then(async (res) => {
      const text = await res.text();
      if (!res.ok) {
        let msg = text || res.statusText;
        try {
          const j = JSON.parse(text) as { detail?: unknown };
          if (typeof j.detail === "string") msg = j.detail;
        } catch {
          /* keep msg */
        }
        throw new Error(msg);
      }
      return JSON.parse(text) as Record<string, unknown>;
    });
  },

  reaudit: (expenseId: number) =>
    request<{
      expense_id: number;
      status: string;
      risk_level: string;
      explanation: string;
      policy_rule: string;
      currency_detected: string;
      region_detected: string;
      violations: { severity: string; rule: string; message: string }[];
    }>(`/expense/${expenseId}/audit`, { method: "POST" }),
};

export function receiptImageUrl(receiptPath: string | null | undefined): string | null {
  if (!receiptPath) return null;
  const normalized = receiptPath.replace(/\\/g, "/");
  const base = API_BASE.replace(/\/$/, "");
  if (normalized.startsWith("http")) return normalized;
  const name = normalized.split("/").pop() || normalized;
  return `${base}/uploads/${name}`;
}
