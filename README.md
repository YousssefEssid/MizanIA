# AvancI

Earned-wage / advance demo: HR CSV upload, lightweight boosted-tree **% cap** model, hash-chained **internal wallets**, role-based JWT auth, HR policy thresholds.

- `app/`, `ml/`, `scripts/` — FastAPI backend + XGBoost model + seed script.
- `frontend/` — Next.js 15 (App Router, Tailwind, shadcn) AvancI console + employee portal,
  wired to the API.

### Ports (two processes — not a bug)

| What | Port | Command / URL |
|------|------|----------------|
| **API (FastAPI)** | **8000** | `uvicorn … --port 8000` → [http://127.0.0.1:8000](http://127.0.0.1:8000) (landing + `/docs`) |
| **Web UI (AvancI)** | **3000** | `cd frontend && npm run dev` → [http://localhost:3000](http://localhost:3000) |

You need **both** running for the full demo: the browser UI on 3000 talks to the API on 8000.

## Backend quick start (Windows)

```powershell
cd d:\jects\WALLAIT
python -m venv .venv
.\.venv\Scripts\pip install -r requirements.txt
.\.venv\Scripts\python ml\train.py
.\.venv\Scripts\python scripts\seed.py
.\.venv\Scripts\uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

- API docs: `http://127.0.0.1:8000/docs`
- Amounts are **integer millimes** (1.000 TND = `1000` millimes).
- **SQLite path:** By default the API uses **`avanci.db` in the repo root** (next to `app/`), not "current working directory". That way starting Uvicorn from another folder still uses the same database and seeded users. Override with `DATABASE_URL` in `.env` if needed.
- **Schema migration:** `init_db()` runs a tiny SQLite-only migration that adds the `policy_max_pct` column on `employee_profiles` and the `global_policy_max_pct` column on `employer_policies` if they're missing — no Alembic needed for the demo.

## Frontend quick start (Windows)

```powershell
cd d:\jects\WALLAIT\frontend
copy .env.local.example .env.local        # defaults to http://127.0.0.1:8000 (API port)
npm install
npm run dev                                # http://localhost:3000
```

The frontend talks to the FastAPI backend via `NEXT_PUBLIC_API_BASE_URL` (defaults to
`http://127.0.0.1:8000` if unset). CORS is open in dev (`CORS_ORIGINS=*`). On login the user is routed by role:

- `hr_admin` → `/company/dashboard`
- `employee` → `/employee`
- `superadmin` → `/admin`

### Brand & UI notes

- **Wordmark:** "**AvancI**" rendered in a Google **Great Vibes** script. The leading `A` and trailing `I` use the olive-green brand token (`--brand-olive`, matches the highlighted-tab tone) to emphasise the "AI" framing.
- **Mark:** `frontend/public/brand/avanci-mark-light-theme.png` is the single source for the icon. In dark mode the same PNG is rendered with `brightness-0 invert` so it reads solid white.
- **Navbar:** sign-in info, dark-mode switch, and sign-out are top-right; product tabs sit underneath. The dark-mode toggle is a clean pill (no inner sun/moon glyph) with sun/moon hint icons on either side.

## HR policy controls

HR admins can set, per employer, three layers that constrain the model:

- **Global cap (`global_policy_max_pct`)** — optional employer-wide ceiling that applies to **every** employee.
- **Per-employee cap (`policy_max_pct`)** — optional row override. Capped at `min(model_recommendation, global_policy_max_pct)`.
- **Monthly cut-off day (`request_cutoff_day_of_month`)** — employees cannot create new requests after this day of the month.

Effective cap used at request time (`app/services/ml_service.py::score_request`):

```
effective_max_pct = min(
    model_recommended_pct,
    global_policy_max_pct or +inf,
    employee.policy_max_pct or +inf,
)
```

Endpoints:

- `GET /hr/policy` · `PUT /hr/policy` — `{ request_cutoff_day_of_month, global_policy_max_pct }`
- `PUT /hr/employees/{id}/policy` — `{ policy_max_pct }` (validated against the lower of model and global)
- `GET /hr/employees` returns each row enriched with `global_policy_max_pct` so the UI can show the same effective cap everywhere.

The AvancI UI exposes these in `/company/policy` (single **Employer-wide policy** card with cut-off + global %, plus a per-row table). Employee surfaces (`/employee`, `/employee/request`) display the effective cap and, when the cap is below the model, surface why ("Model X% · Global HR Y% · Your HR Z%").

## HR roster upload

`POST /hr/employees/upload` (CSV/XLSX) upserts by `employee_code`:

- Required: `employee_code, full_name, department, salary_millimes, hire_date`
- Optional: `performance_score, on_time_repayment_rate, past_advance_count, days_since_last_advance, has_active_advance, dept_attrition_rate, existing_debt_ratio, opted_in_wallet`
- **Deduplication:** the importer trims `employee_code` and runs `drop_duplicates(keep="last")` so a single file with the same code on multiple lines updates the row to the **last** values rather than failing or creating dupes. Empty / `nan` codes raise a row error.

The Upload tab (`/company/upload`) shows a compact **summary** for the picked file (data row count + unique codes, with a hint when the duplicate dedup will kick in). Scoring + the eligibility table live separately in `/company/results` ("Run model" button + decorated employees table).

## Wallets & hash chain

- Each employer + each opted-in employee has an internal `Wallet` (millimes).
- Every credit/debit appends a `LedgerEntry` whose `entry_hash = SHA256(canonical(payload) || prev_hash)`, so the chain is tamper-evident.
- `GET /wallets/{id}/ledger` lists entries; `GET /wallets/{id}/verify-chain` recomputes the chain end-to-end and returns either `{ ok: true, entry_count }` or `{ ok: false, broken_at_entry_id }`.
- The Wallet tab surfaces a **Verify chain** button that shows a "Chain OK" or "Broken at #…" badge based on that response.

## Dashboard & results

- `/company/dashboard` is intentionally compact: 4 KPI cards (employees imported, eligible, pending, wallet balance) + a single **Recent paid advances** card. The previous illustrative trend chart and quick-actions block were removed in favour of the top tabs.
- `/company/results` exposes the eligibility table with filters (search, eligibility, wallet opt-in) and a per-employee detail sheet that shows model %, HR override, global HR cap, and effective cap.

## Training data (your 5k file)

Place CSV at `ml/training_data.csv` or set `TRAINING_CSV` to its path. Required columns:

`month_elapsed_pct`, `salary_tier`, `tenure_months`, `past_advance_count`, `on_time_repayment_rate`, `dept_attrition_rate`, `performance_score`, `has_active_advance`, `days_since_last_advance`, `existing_debt_ratio`, `requested_amount_pct`, `true_max_pct`

If the file is missing, `ml/train.py` trains on a small synthetic set so the demo still runs.

## Demo logins (after `scripts/seed.py`)

- Superadmin: `super@avanci.tn` / `superadmin123`
- HR: `hr@demo.tn` / `demo1234`
- Employees: `amine@demo.tn`, `sarra@demo.tn` / `employee123`

### Auto-created roster logins (demo)

When HR runs **`POST /hr/employees/score`**, the API ensures every employee profile for that employer has an employee `User` if it did not already:

- **Email:** `{employee_code}` + `@` + the domain of the **logged-in HR user's** work email (e.g. HR `hr@demo.tn` → Afef with code `DEMO-002` gets `demo-002@demo.tn`; codes are normalized to a safe local part).
- **Password:** `123456` (demo only).
- Rows that already have an employee account linked to that profile are left unchanged.

## Pitch flow (~90s)

1. HR signs in → **Upload** roster (CSV/XLSX, summary with dedup hint) → **Results** → **Run model** → review eligibility.
2. HR opens **Policy** → set monthly cut-off + optional global HR max %, plus per-row caps as needed.
3. HR funds the employer **Wallet** (Wallet tab) and clicks **Verify chain** to show the hash-chain badge.
4. Employee signs in → `/employee/request` → submits an advance (effective cap = min(model, global HR, row HR)).
5. HR approves the request → atomic transfer (employer wallet debit + employee wallet credit, both ledger entries chained) → status `paid`.
6. `GET /hr/reports/payroll-deductions?year=2026&month=4` for the monthly payroll deduction report.

## Note on passwords

Hashing uses the `bcrypt` library directly (avoids `passlib` / `bcrypt` version friction on some Windows installs).
