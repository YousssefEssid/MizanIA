/**
 * Thin fetch wrapper for the Avanci FastAPI backend.
 *
 * Auth model:
 *   - JWT in localStorage under TOKEN_KEY.
 *   - Every request adds Authorization: Bearer <jwt> when present.
 *   - 401 responses clear the token so the AuthProvider can boot the user back to /login.
 *
 * All money values on the wire are integer **millimes** (1 TND = 1000 millimes).
 */

export const TOKEN_KEY = "avanci.token";
const LEGACY_TOKEN_KEYS = ["wallait.token"];

/** Prefer 127.0.0.1: some environments resolve `localhost` to ::1 while the API only listens on IPv4. */
export const API_BASE_URL =
  (typeof process !== "undefined" && process.env.NEXT_PUBLIC_API_BASE_URL) ||
  "http://127.0.0.1:8000";

export type Role = "superadmin" | "hr_admin" | "employee";

export type Me = {
  id: number;
  email: string;
  role: Role;
  employer_id: number | null;
  employee_profile_id: number | null;
};

export type EligibilityRow = {
  employee_profile_id: number;
  employee_code: string;
  full_name: string;
  recommended_max_pct: number | null;
  salary_millimes: number;
  opted_in_wallet: boolean;
};

export type EmployeePublic = {
  id: number;
  employee_code: string;
  full_name: string;
  department: string;
  salary_millimes: number;
  recommended_max_pct: number | null;
  policy_max_pct: number | null;
  global_policy_max_pct?: number | null;
  last_scored_at: string | null;
  opted_in_wallet: boolean;
};

export type AdvanceStatus = "pending" | "approved" | "rejected" | "paid";

export type AdvanceRequestHR = {
  id: number;
  employee_profile_id: number;
  employee_name: string;
  requested_amount_millimes: number;
  requested_payout_date: string;
  status: AdvanceStatus;
  model_recommended_pct: number | null;
  model_recommended_amount_millimes: number | null;
  created_at: string;
};

export type PayrollLine = {
  employee_profile_id: number;
  employee_code: string;
  full_name: string;
  total_advanced_millimes: number;
};

export type EmployerWalletInfo = {
  employer_id: number;
  wallet_id: number;
  balance_millimes: number;
};

export type Profile = {
  id: number;
  full_name: string;
  department: string;
  salary_millimes: number;
  recommended_max_pct: number | null;
  policy_max_pct: number | null;
  global_policy_max_pct?: number | null;
  request_cutoff_day_of_month: number | null;
};

export type EmployerPolicy = {
  request_cutoff_day_of_month: number | null;
  global_policy_max_pct: number | null;
};

export type WalletOut = {
  balance_millimes: number;
  currency: string;
};

export type LedgerEntryView = {
  id: number;
  direction: "debit" | "credit";
  amount_millimes: number;
  related_request_id: number | null;
  entry_hash: string;
  created_at: string;
};

export type MyWalletResponse = {
  wallet_id: number;
  wallet: WalletOut;
  recent: LedgerEntryView[];
};

export type AdvanceCreateResponse = {
  request_id: number;
  status: AdvanceStatus;
  model_recommended_pct: number | null;
  model_recommended_amount_millimes: number | null;
  within_model_cap: boolean;
  note: string;
};

export type MyAdvance = {
  id: number;
  requested_amount_millimes: number;
  requested_payout_date: string;
  status: AdvanceStatus;
  model_recommended_pct: number | null;
  model_recommended_amount_millimes: number | null;
  created_at: string;
};

export type WalletLedger = {
  wallet_id: number;
  balance_millimes: number;
  entries: {
    id: number;
    direction: "debit" | "credit";
    amount_millimes: number;
    prev_hash: string;
    entry_hash: string;
    related_request_id: number | null;
    created_at: string;
  }[];
};

export type VerifyChainResponse = {
  ok: boolean;
  broken_at?: number | null;
  broken_at_entry_id?: number | null;
  reason?: string | null;
  count?: number;
  entry_count?: number;
};

export class ApiError extends Error {
  status: number;
  data: unknown;
  constructor(status: number, message: string, data?: unknown) {
    super(message);
    this.status = status;
    this.data = data;
  }
}

function readToken(): string | null {
  if (typeof window === "undefined") return null;
  const cur = window.localStorage.getItem(TOKEN_KEY);
  if (cur) return cur;
  for (const k of LEGACY_TOKEN_KEYS) {
    const legacy = window.localStorage.getItem(k);
    if (legacy) {
      window.localStorage.setItem(TOKEN_KEY, legacy);
      window.localStorage.removeItem(k);
      return legacy;
    }
  }
  return null;
}

export function setToken(token: string | null) {
  if (typeof window === "undefined") return;
  if (token) window.localStorage.setItem(TOKEN_KEY, token);
  else window.localStorage.removeItem(TOKEN_KEY);
  for (const k of LEGACY_TOKEN_KEYS) window.localStorage.removeItem(k);
}

type RequestOptions = {
  method?: string;
  body?: unknown;
  form?: URLSearchParams;
  multipart?: FormData;
  query?: Record<string, string | number | boolean | undefined | null>;
  signal?: AbortSignal;
};

async function request<T>(path: string, opts: RequestOptions = {}): Promise<T> {
  const url = new URL(path.startsWith("http") ? path : `${API_BASE_URL}${path}`);
  if (opts.query) {
    for (const [k, v] of Object.entries(opts.query)) {
      if (v === undefined || v === null || v === "") continue;
      url.searchParams.set(k, String(v));
    }
  }

  const headers: Record<string, string> = {};
  const token = readToken();
  if (token) headers["Authorization"] = `Bearer ${token}`;

  let body: BodyInit | undefined;
  if (opts.multipart) {
    body = opts.multipart;
  } else if (opts.form) {
    headers["Content-Type"] = "application/x-www-form-urlencoded";
    body = opts.form;
  } else if (opts.body !== undefined) {
    headers["Content-Type"] = "application/json";
    body = JSON.stringify(opts.body);
  }

  const res = await fetch(url.toString(), {
    method: opts.method || (body ? "POST" : "GET"),
    headers,
    body,
    signal: opts.signal,
  });

  const text = await res.text();
  let parsed: unknown = null;
  if (text) {
    try {
      parsed = JSON.parse(text);
    } catch {
      parsed = text;
    }
  }

  if (!res.ok) {
    if (res.status === 401) setToken(null);
    const detail =
      (parsed && typeof parsed === "object" && "detail" in parsed
        ? (parsed as { detail: unknown }).detail
        : null) ?? text ?? res.statusText;
    let message: string;
    if (typeof detail === "string") {
      message = detail;
    } else if (Array.isArray(detail)) {
      message = detail
        .map((d: unknown) =>
          typeof d === "object" && d !== null && "msg" in d
            ? String((d as { msg: unknown }).msg)
            : JSON.stringify(d),
        )
        .join("; ");
    } else {
      message = JSON.stringify(detail);
    }
    throw new ApiError(res.status, message, parsed);
  }

  return parsed as T;
}

/* -------------------------------------------------------------------------- */
/*                                 Auth                                       */
/* -------------------------------------------------------------------------- */

export async function login(email: string, password: string) {
  const form = new URLSearchParams();
  form.set("username", email);
  form.set("password", password);
  const res = await request<{ access_token: string; token_type: string }>("/auth/login", {
    method: "POST",
    form,
  });
  setToken(res.access_token);
  return res;
}

export const me = () => request<Me>("/auth/me");

export function logout() {
  setToken(null);
}

/* -------------------------------------------------------------------------- */
/*                                 HR                                         */
/* -------------------------------------------------------------------------- */

export const hrEmployees = () => request<EmployeePublic[]>("/hr/employees");

export const hrEligibility = (minPct = 0) =>
  request<EligibilityRow[]>("/hr/dashboard/eligibility", { query: { min_pct: minPct } });

export const hrRequests = (status?: AdvanceStatus) =>
  request<AdvanceRequestHR[]>("/hr/dashboard/requests", { query: { status } });

export const hrApprove = (id: number) =>
  request<{ id: number; status: string; payout_ledger_entry_id: number | null }>(
    `/hr/requests/${id}/approve`,
    { method: "POST" },
  );

export const hrReject = (id: number, reason: string) =>
  request<{ id: number; status: string }>(`/hr/requests/${id}/reject`, {
    method: "POST",
    body: { reject_reason: reason },
  });

export type ScoreEmployeesResponse = {
  scored: number;
  employee_accounts_created: number;
  employee_accounts_already_linked: number;
};

export const hrScoreAll = () =>
  request<ScoreEmployeesResponse>("/hr/employees/score", { method: "POST" });

export type CsvUploadError = { row: number; error: string };

export const hrUploadCsv = (file: File) => {
  const fd = new FormData();
  fd.append("file", file);
  return request<{ created: number; updated: number; errors: CsvUploadError[] }>(
    "/hr/employees/upload",
    { method: "POST", multipart: fd },
  );
};

export const hrWallet = () => request<EmployerWalletInfo>("/hr/wallet");

export const hrFundWallet = (amountMillimes: number) =>
  request<EmployerWalletInfo>("/hr/wallet/fund", {
    method: "POST",
    body: { amount_millimes: amountMillimes },
  });

export const hrPayrollDeductions = (year: number, month: number) =>
  request<PayrollLine[]>("/hr/reports/payroll-deductions", { query: { year, month } });

export const hrGetPolicy = () => request<EmployerPolicy>("/hr/policy");

export const hrUpdatePolicy = (policy: Partial<EmployerPolicy>) =>
  request<EmployerPolicy>("/hr/policy", { method: "PUT", body: policy });

export const hrUpdateEmployeePolicy = (
  employeeId: number,
  policyMaxPct: number | null,
) =>
  request<EmployeePublic>(`/hr/employees/${employeeId}/policy`, {
    method: "PUT",
    body: { policy_max_pct: policyMaxPct },
  });

/* -------------------------------------------------------------------------- */
/*                              Employee (/me)                                */
/* -------------------------------------------------------------------------- */

export const myProfile = () => request<Profile>("/me/profile");
export const myWallet = () => request<MyWalletResponse>("/me/wallet");
export const myAdvances = () => request<MyAdvance[]>("/me/advances");

export const createAdvance = (amountMillimes: number, payoutDate: string) =>
  request<AdvanceCreateResponse>("/me/advances", {
    method: "POST",
    body: { amount_millimes: amountMillimes, payout_date: payoutDate },
  });

/* -------------------------------------------------------------------------- */
/*                                 Wallets                                    */
/* -------------------------------------------------------------------------- */

export const walletLedger = (id: number, limit = 50) =>
  request<WalletLedger>(`/wallets/${id}/ledger`, { query: { limit } });

export const verifyChain = (id: number) =>
  request<VerifyChainResponse>(`/wallets/${id}/verify-chain`);

/* -------------------------------------------------------------------------- */
/*                              Superadmin                                    */
/* -------------------------------------------------------------------------- */

export const adminCreateEmployer = (name: string) =>
  request<{ id: number; name: string; country: string }>("/admin/employers", {
    method: "POST",
    body: { name },
  });

export const adminCreateHrAdmin = (employerId: number, email: string, password: string) =>
  request<{ id: number; email: string }>(`/admin/employers/${employerId}/hr-admins`, {
    method: "POST",
    body: { email, password },
  });
