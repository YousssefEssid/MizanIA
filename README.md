# WALLAIT

Earned-wage / advance demo: HR CSV upload, lightweight boosted-tree **% cap** model, hash-chained **internal wallets**, role-based JWT auth.

- `app/`, `ml/`, `scripts/` — FastAPI backend + XGBoost model + seed script.
- `frontend/` — Next.js 15 (App Router, Tailwind, shadcn) console + employee portal,
  cloned from [`YousssefEssid/MizanIA`](https://github.com/YousssefEssid/MizanIA) and wired to the API.

### Ports (two processes — not a bug)

| What | Port | Command / URL |
|------|------|----------------|
| **API (FastAPI)** | **8000** | `uvicorn … --port 8000` → [http://127.0.0.1:8000](http://127.0.0.1:8000) (landing + `/docs`) |
| **Web UI (Mizania)** | **3000** | `cd frontend && npm run dev` → [http://localhost:3000](http://localhost:3000) |

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
- **SQLite path:** By default the API uses **`wallait.db` in the repo root** (next to `app/`), not “current working directory”. That way starting Uvicorn from another folder still uses the same database and seeded users. Override with `DATABASE_URL` in `.env` if needed.

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

## Training data (your 5k file)

Place CSV at `ml/training_data.csv` or set `TRAINING_CSV` to its path. Required columns:

`month_elapsed_pct`, `salary_tier`, `tenure_months`, `past_advance_count`, `on_time_repayment_rate`, `dept_attrition_rate`, `performance_score`, `has_active_advance`, `days_since_last_advance`, `existing_debt_ratio`, `requested_amount_pct`, `true_max_pct`

If the file is missing, `ml/train.py` trains on a small synthetic set so the demo still runs.

## Demo logins (after `scripts/seed.py`)

- Superadmin: `super@wallait.tn` / `superadmin123`
- HR: `hr@demo.tn` / `demo1234`
- Employees: `amine@demo.tn`, `sarra@demo.tn` / `employee123`

### Auto-created roster logins (demo)

When HR runs **`POST /hr/employees/score`**, the API ensures every employee profile for that employer has an employee `User` if it did not already:

- **Email:** `{employee_code}` + `@` + the domain of the **logged-in HR user’s** work email (e.g. HR `hr@demo.tn` → Afef with code `DEMO-002` gets `demo-002@demo.tn`; codes are normalized to a safe local part).
- **Password:** `123456` (demo only).
- Rows that already have an employee account linked to that profile are left unchanged.

## Pitch flow (90s)

1. HR logs in → upload roster → `POST /hr/employees/score` (creates missing employee logins + scores) → `GET /hr/dashboard/eligibility`
2. Employee `POST /me/advances` → HR `POST /hr/requests/{id}/approve` (atomic wallet transfer → `paid`)
3. `GET /wallets/{id}/verify-chain` → `{ ok: true }`
4. `GET /hr/reports/payroll-deductions?year=2026&month=4` for payroll deductions

## Note on passwords

Hashing uses the `bcrypt` library directly (avoids `passlib` / `bcrypt` version friction on some Windows installs).
