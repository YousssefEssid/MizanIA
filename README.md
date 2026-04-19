# AvancI

AvancI is an earned-wage / salary-advance platform for small and mid-size
employers. HR uploads a roster, a gradient-boosted model recommends a
percentage cap per employee from payroll signals, HR layers its own
policy on top, employees request advances within that cap, and every
movement is recorded in an internal hash-chained ledger that can be
re-verified end-to-end.

This repository is a working proof of concept that runs the full loop
locally: model training, FastAPI backend, internal wallets, JWT auth, and
a Next.js console for HR + employees.

- `app/`, `ml/`, `scripts/`: FastAPI backend, ML training pipeline, and
  bootstrap script.
- `frontend/`: Next.js 15 (App Router, Tailwind, shadcn) AvancI console
  and employee portal, wired to the API.

### Two processes (not a bug)

| What | Port | Command / URL |
|------|------|----------------|
| **API (FastAPI)** | **8000** | `uvicorn … --port 8000` → [http://127.0.0.1:8000](http://127.0.0.1:8000) (landing + `/docs`) |
| **Web UI (AvancI)** | **3000** | `cd frontend && npm run dev` → [http://localhost:3000](http://localhost:3000) |

You need **both** running for the full product: the browser UI on 3000
talks to the API on 8000.

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
- **SQLite path:** by default the API uses **`avanci.db` in the repo
  root** (next to `app/`), not the current working directory, so
  starting Uvicorn from another folder still uses the same database.
  Override with `DATABASE_URL` in `.env` if needed.
- **Schema migration:** `init_db()` runs a tiny SQLite-only migration
  that adds the `policy_max_pct` column on `employee_profiles` and the
  `global_policy_max_pct` column on `employer_policies` if they are
  missing. No Alembic needed at this stage.

## Frontend quick start (Windows)

```powershell
cd d:\jects\WALLAIT\frontend
copy .env.local.example .env.local        # defaults to http://127.0.0.1:8000 (API port)
npm install
npm run dev                                # http://localhost:3000
```

The frontend talks to the FastAPI backend via `NEXT_PUBLIC_API_BASE_URL`
(defaults to `http://127.0.0.1:8000` if unset). CORS is open in dev
(`CORS_ORIGINS=*`). On login the user is routed by role:

- `hr_admin` → `/company/dashboard`
- `employee` → `/employee`
- `superadmin` → `/admin`

### Brand & UI notes

- **Wordmark:** "**AvancI**" rendered in a Google **Dancing Script**
  face. The leading `A` and trailing `I` use a cyan-blue brand token
  (`--brand-olive`) to emphasise the "AI" framing.
- **Mark:** `frontend/public/brand/avanci-mark-light-theme.png` is the
  single source for the icon. In dark mode the same PNG is rendered
  with `brightness-0 invert` so it reads solid white.
- **Navbar:** sign-in info, dark-mode switch, and sign-out are
  top-right; product tabs sit underneath. The dark-mode toggle is a
  clean pill (no inner sun/moon glyph) with sun/moon hint icons on
  either side.

## The advance-cap model

The core of AvancI is a regression model that predicts, for an
individual employee on a given day, the **maximum percentage of monthly
salary** the platform should be willing to advance. The model is the
first line of defence against over-advancing: HR policy sits on top of
it, never under it.

### Features (`app/services/ml_service.py::FEATURE_NAMES`)

The same eleven features are produced both at training time
(`ml/train.py`) and at request time (`build_features` in
`ml_service.py`), so there is no skew between offline metrics and live
predictions:

| Feature | Source / meaning |
|---------|------------------|
| `month_elapsed_pct` | day-of-month / days-in-month (recency in payroll cycle) |
| `salary_tier` | bucketed salary band (low / mid / high) |
| `tenure_months` | months since `hire_date` |
| `past_advance_count` | lifetime number of approved advances |
| `on_time_repayment_rate` | share of past payroll deductions covering the advance on time |
| `dept_attrition_rate` | rolling attrition for the employee's department |
| `performance_score` | 1.0 – 5.0 HR review score |
| `has_active_advance` | bool: an advance is currently outstanding |
| `days_since_last_advance` | clamped at 365 |
| `existing_debt_ratio` | external debt / monthly salary |
| `requested_amount_pct` | the request being scored (0 when only ranking) |

The label is `true_max_pct` in `[0, 50]`.

### Training pipeline (`ml/train.py`)

- Reads `ml/training_data.csv` (or any CSV pointed to by
  `TRAINING_CSV`) with the columns above plus `true_max_pct`.
- If no CSV is present, falls back to a deterministic synthetic
  generator so the rest of the stack still runs end-to-end while real
  data is being collected.
- Splits 85 / 15, fits an **XGBoost regressor** (n=80, depth=4,
  lr=0.08, subsample/colsample 0.9), reports holdout MAE in pct
  points, and writes `ml/model.json`.
- Falls back to scikit-learn's `HistGradientBoostingRegressor` written
  to `ml/model.joblib` if XGBoost is unavailable on the host. The
  service auto-detects which artifact is on disk at load time.

A heuristic (`_rule_based_max_pct`) is kept as a third fallback used by
`predict_max_pct` when neither artifact loads, so the API is never down
on inference: it just degrades gracefully.

### Inference path

`predict_max_pct(profile, today)` is called in two places:

- **Bulk scoring** when HR clicks "Run model" in `/company/results`
  (route: `POST /hr/employees/score`). Each employee gets
  `recommended_max_pct` and a `last_scored_at` timestamp.
- **Per-request scoring** inside `score_request(profile, amount,
  global_policy_max_pct)` when an employee submits an advance. This
  call combines the model output with HR caps to compute the effective
  ceiling shown to the user and used to gate the request.

Both paths share the same feature builder and the same model artifact,
so the number HR sees in the eligibility table is exactly the number
the request endpoint enforces.

## HR policy controls

HR sets, per employer, three layers that can constrain the model. The
model recommendation is the **upper bound**; HR can only tighten it,
never raise it.

- **Global cap (`global_policy_max_pct`):** optional employer-wide
  ceiling that applies to every employee.
- **Per-employee cap (`policy_max_pct`):** optional row override.
  Capped at `min(model_recommendation, global_policy_max_pct)`.
- **Monthly cut-off day (`request_cutoff_day_of_month`):** employees
  cannot create new requests after this day of the month.

Effective cap used at request time
(`app/services/ml_service.py::score_request`):

```
effective_max_pct = min(
    model_recommended_pct,
    global_policy_max_pct or +inf,
    employee.policy_max_pct or +inf,
)
```

Endpoints:

- `GET /hr/policy` · `PUT /hr/policy`:
  `{ request_cutoff_day_of_month, global_policy_max_pct }`
- `PUT /hr/employees/{id}/policy`: `{ policy_max_pct }` (validated
  against the lower of model and global)
- `GET /hr/employees` returns each row enriched with
  `global_policy_max_pct` so the UI can show the same effective cap
  everywhere.

The UI exposes these in `/company/policy` (single **Employer-wide
policy** card with cut-off + global %, plus a per-row table). Employee
surfaces (`/employee`, `/employee/request`) display the effective cap
and, when the cap is below the model, surface why
("Model X% · Global HR Y% · Your HR Z%").

## HR roster upload

`POST /hr/employees/upload` (CSV/XLSX) upserts by `employee_code`:

- Required: `employee_code, full_name, department, salary_millimes,
  hire_date`
- Optional: `performance_score, on_time_repayment_rate,
  past_advance_count, days_since_last_advance, has_active_advance,
  dept_attrition_rate, existing_debt_ratio, opted_in_wallet`
- **Deduplication:** the importer trims `employee_code` and runs
  `drop_duplicates(keep="last")` so a single file with the same code on
  multiple lines updates the row to the **last** values rather than
  failing or creating dupes. Empty / `nan` codes raise a row error.

The Upload tab (`/company/upload`) shows a compact **summary** for the
picked file (data row count + unique codes, with a hint when the
duplicate dedup will kick in). Scoring + the eligibility table live
separately in `/company/results` ("Run model" button + decorated
employees table).

## Wallets & hash chain

- Each employer and each opted-in employee has an internal `Wallet`
  (millimes).
- Every credit/debit appends a `LedgerEntry` whose
  `entry_hash = SHA256(canonical(payload) || prev_hash)`, so the chain
  is tamper-evident: changing any past entry breaks every entry that
  follows.
- `GET /wallets/{id}/ledger` lists entries;
  `GET /wallets/{id}/verify-chain` recomputes the chain end-to-end and
  returns either `{ ok: true, entry_count }` or
  `{ ok: false, broken_at_entry_id }`.
- Approving a request is an **atomic transfer**: employer wallet
  debit + employee wallet credit, both ledger entries written under one
  transaction so the chain on either side stays consistent.
- The Wallet tab surfaces a **Verify chain** button that shows a
  "Chain OK" or "Broken at #…" badge based on that response.

## Dashboard & results

- `/company/dashboard` is intentionally compact: 4 KPI cards
  (employees imported, eligible, pending, wallet balance) plus a single
  **Recent paid advances** card.
- `/company/results` exposes the eligibility table with filters
  (search, eligibility, wallet opt-in) and a per-employee detail sheet
  that shows model %, HR override, global HR cap, and effective cap.
- `/company/repayments` (labelled **Payroll deductions** in the nav)
  lists the per-employee total of advances paid in a given month, ready
  to hand to payroll.

## Training data

Place CSV at `ml/training_data.csv` or set `TRAINING_CSV` to its path.
Required columns:

`month_elapsed_pct`, `salary_tier`, `tenure_months`,
`past_advance_count`, `on_time_repayment_rate`, `dept_attrition_rate`,
`performance_score`, `has_active_advance`, `days_since_last_advance`,
`existing_debt_ratio`, `requested_amount_pct`, `true_max_pct`

If the file is missing, `ml/train.py` trains on a small synthetic set
so the platform still runs end-to-end while real data is being
collected.

## Seeded accounts (after `scripts/seed.py`)

`scripts/seed.py` provisions a starter tenant ("Demo Tunis SARL") so
the stack is usable immediately after install. These passwords are
**bootstrap credentials only** and should be replaced before any
real-world use.

- Superadmin: `super@avanci.tn` / `superadmin123`
- HR: `hr@demo.tn` / `demo1234`
- Employees: `amine@demo.tn`, `sarra@demo.tn` / `employee123`

The seed script also re-asserts the superadmin password on every run
and migrates legacy superadmin emails (e.g. pre-rebrand
`super@wallait.tn`) to the canonical address, so the entry point stays
reliable across schema changes.

### Auto-created roster logins

When HR runs **`POST /hr/employees/score`**, the API ensures every
employee profile for that employer has an employee `User` if it did not
already:

- **Email:** `{employee_code}` + `@` + the domain of the **logged-in HR
  user's** work email (e.g. HR `hr@demo.tn` → Afef with code
  `DEMO-002` gets `demo-002@demo.tn`; codes are normalized to a safe
  local part).
- **Password:** `123456` (bootstrap only).
- Rows that already have an employee account linked to that profile are
  left unchanged.

## End-to-end flow

1. HR signs in → **Upload** roster (CSV/XLSX, summary with dedup hint)
   → **Results** → **Run model** → review eligibility (model output
   per row).
2. HR opens **Policy** → set monthly cut-off + optional global HR
   max %, plus per-row caps as needed.
3. HR funds the employer **Wallet** (Wallet tab) and clicks **Verify
   chain** to confirm the ledger.
4. Employee signs in → `/employee/request` → submits an advance
   (effective cap = `min(model, global HR, row HR)`).
5. HR approves the request → atomic transfer (employer wallet debit +
   employee wallet credit, both ledger entries chained) → status
   `paid`.
6. `GET /hr/reports/payroll-deductions?year=YYYY&month=M` for the
   monthly payroll deduction report.

## Note on passwords

Hashing uses the `bcrypt` library directly (avoids `passlib` /
`bcrypt` version friction on some Windows installs).
