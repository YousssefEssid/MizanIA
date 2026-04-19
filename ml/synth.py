"""
ml/synth.py
-----------
Generates synthetic Tunisian employee data for Avanci EWA model training.

Two public functions:
  generate_training_data(n=5000, seed=42) -> pd.DataFrame
      Full feature matrix with ground-truth `true_max_pct` label.

  generate_sample_employees(n=100, seed=99) -> pd.DataFrame
      HR-uploadable CSV rows (employee_code, full_name, department, …).
      No ML label — mirrors the columns expected by csv_service.py.

  generate_live_demo_employees(n=16, ...) -> pd.DataFrame
      10–20-row batch for live pitch: salaries ~ N(mean_salary_tnd, std) clipped,
      mean ≈ 700 DT; codes DEMO-001…; most rows opted_in_wallet for demos.

Design notes
------------
- Tunisian names come from a curated list, not Faker('ar_AA'), which
  produces generic Arabic gibberish useless for a Tunisian demo.
- Features are correlated the way real payroll data is:
    * high salary tier → lower attrition, higher performance
    * high debt ratio  → lower repayment rate
    * long tenure      → more past advances (people know the product)
    * has_active_advance forces has_active_advance=1 on ~15% of rows
      and bumps existing_debt_ratio up for those rows
- Salaries stored as integer millimes (TND × 1000) matching the DB schema.
- All amounts in TND: low 800–1500, mid 1500–3500, high 3500–8000.
"""

from __future__ import annotations

import calendar
from datetime import date, timedelta

import numpy as np
import pandas as pd

# ---------------------------------------------------------------------------
# Tunisian name corpus (real common names, bilingual as Tunisia actually is)
# ---------------------------------------------------------------------------
FIRST_NAMES_M = [
    "Mohamed", "Ahmed", "Yassine", "Hamza", "Amine", "Bilel", "Khaled",
    "Sami", "Anis", "Lotfi", "Walid", "Tarek", "Nizar", "Wael", "Hatem",
    "Firas", "Maher", "Aymen", "Riadh", "Zied", "Houssem", "Skander",
    "Mehdi", "Karim", "Slim", "Hichem", "Adel", "Imed", "Rachid", "Bechir",
]
FIRST_NAMES_F = [
    "Fatma", "Amira", "Sonia", "Rania", "Ines", "Salma", "Yasmine",
    "Meryem", "Nadia", "Asma", "Rim", "Olfa", "Sirine", "Hajer",
    "Emna", "Cyrine", "Hana", "Mariem", "Ons", "Leila", "Samira",
    "Nesrine", "Afef", "Houda", "Dorra", "Wafa", "Ahlem", "Sawsen",
    "Manel", "Rym",
]
LAST_NAMES = [
    "Ben Ali", "Trabelsi", "Gharbi", "Hamdi", "Jebali", "Chaabane",
    "Mansour", "Boukthir", "Mejri", "Riahi", "Khlifi", "Dridi",
    "Ayari", "Saidi", "Tlili", "Bouzid", "Nasri", "Ferchichi",
    "Meddeb", "Oueslati", "Khemiri", "Boujemaa", "Elloumi", "Cherif",
    "Belhadj", "Zouari", "Hammami", "Jedidi", "Boughanmi", "Laabidi",
    "Yahyaoui", "Bensalem", "Chahed", "Fakhfakh", "Mechri",
]

DEPARTMENTS = ["Engineering", "Sales", "Support", "Logistics", "Finance"]

# Attrition is higher in Sales/Support, lower in Finance/Engineering
DEPT_ATTRITION = {
    "Engineering": (0.05, 0.18),
    "Sales":       (0.12, 0.30),
    "Support":     (0.10, 0.25),
    "Logistics":   (0.08, 0.22),
    "Finance":     (0.04, 0.14),
}

# Salary tier distribution per department (index = tier 0/1/2)
# Engineering/Finance skew higher, Support/Logistics skew lower
DEPT_TIER_PROBS = {
    "Engineering": [0.15, 0.50, 0.35],
    "Sales":       [0.30, 0.50, 0.20],
    "Support":     [0.45, 0.45, 0.10],
    "Logistics":   [0.40, 0.45, 0.15],
    "Finance":     [0.10, 0.45, 0.45],
}

# TND salary ranges per tier (min, max) — stored as millimes in DB
SALARY_RANGES_TND = {
    0: (800,  1_500),   # low
    1: (1_500, 3_500),  # mid
    2: (3_500, 8_000),  # high
}


def _salary_tier_from_millimes(salary_millimes: int) -> int:
    """Same bins as ml_service._salary_tier (TND thresholds)."""
    tnd = salary_millimes / 1000.0
    if tnd < 1500:
        return 0
    if tnd < 3500:
        return 1
    return 2


# ---------------------------------------------------------------------------
# Helper utilities
# ---------------------------------------------------------------------------

def _rng(seed: int) -> np.random.Generator:
    return np.random.default_rng(seed)


def _sample_name(rng: np.random.Generator) -> str:
    if rng.random() < 0.5:
        first = rng.choice(FIRST_NAMES_M)
    else:
        first = rng.choice(FIRST_NAMES_F)
    last = rng.choice(LAST_NAMES)
    return f"{first} {last}"


def _employee_code(idx: int, prefix: str = "EMP") -> str:
    return f"{prefix}{idx:05d}"


def _random_hire_date(rng: np.random.Generator, today: date) -> date:
    """Tenure between 1 month and 20 years, log-skewed toward shorter tenures."""
    max_days = 365 * 20
    # log-uniform so short tenures are more common
    days = int(np.exp(rng.uniform(np.log(30), np.log(max_days))))
    days = min(days, max_days)
    return today - timedelta(days=days)


def _tenure_months(hire_date: date, today: date) -> float:
    delta = today - hire_date
    return delta.days / 30.44


# ---------------------------------------------------------------------------
# Core row generator
# ---------------------------------------------------------------------------

def _build_row(
    idx: int,
    rng: np.random.Generator,
    today: date,
    include_label: bool = True,
    salary_millimes_override: int | None = None,
) -> dict:
    dept = rng.choice(DEPARTMENTS)
    if salary_millimes_override is not None:
        salary_millimes = int(salary_millimes_override)
        salary_tier = _salary_tier_from_millimes(salary_millimes)
    else:
        tier_probs = DEPT_TIER_PROBS[dept]
        salary_tier = int(rng.choice([0, 1, 2], p=tier_probs))
        lo, hi = SALARY_RANGES_TND[salary_tier]
        salary_tnd = float(rng.uniform(lo, hi))
        salary_millimes = int(round(salary_tnd * 1000))

    hire_date = _random_hire_date(rng, today)
    tenure_months = _tenure_months(hire_date, today)

    # Performance: correlated with tier (higher earners tend to perform better)
    perf_mean = 2.5 + 0.8 * salary_tier + rng.normal(0, 0.3)
    performance_score = float(np.clip(round(perf_mean * 2) / 2, 1.0, 5.0))  # 0.5 steps

    # Dept attrition
    att_lo, att_hi = DEPT_ATTRITION[dept]
    dept_attrition_rate = float(rng.uniform(att_lo, att_hi))

    # Past advance count: longer tenured employees have used the product more
    max_advances = max(0, int(tenure_months / 6))  # ~2 per year
    past_advance_count = int(rng.integers(0, max(1, max_advances) + 1))

    # has_active_advance: ~15% of employees
    has_active_advance = int(rng.random() < 0.15)

    # days_since_last_advance
    if past_advance_count == 0:
        days_since_last_advance = 365  # cap — never used
    elif has_active_advance:
        days_since_last_advance = int(rng.integers(1, 45))
    else:
        days_since_last_advance = int(rng.integers(10, 366))
    days_since_last_advance = min(days_since_last_advance, 365)

    # existing_debt_ratio: higher if has_active_advance
    if has_active_advance:
        existing_debt_ratio = float(np.clip(rng.beta(3, 4) * 0.6 + 0.1, 0.0, 0.8))
    else:
        existing_debt_ratio = float(np.clip(rng.beta(1, 6), 0.0, 0.5))

    # on_time_repayment_rate: negatively correlated with debt ratio
    base_repay = 0.90 - 0.4 * existing_debt_ratio + rng.normal(0, 0.05)
    on_time_repayment_rate = float(np.clip(base_repay, 0.0, 1.0))
    if past_advance_count == 0:
        on_time_repayment_rate = float(np.clip(rng.uniform(0.7, 1.0), 0.0, 1.0))

    # month context
    month_elapsed_pct = today.day / calendar.monthrange(today.year, today.month)[1]

    # Vary requested_amount_pct so the feature has real variance in training.
    # The label is independent of it (a real "what would you request?" is not
    # something the model should be biased by); XGBoost will learn ~0 importance.
    requested_amount_pct = float(rng.uniform(0.0, 50.0))

    row = {
        "employee_code":          _employee_code(idx),
        "full_name":              _sample_name(rng),
        "department":             dept,
        "salary_millimes":        salary_millimes,
        "hire_date":              hire_date.isoformat(),
        # ML features
        "month_elapsed_pct":      round(month_elapsed_pct, 4),
        "salary_tier":            salary_tier,
        "tenure_months":          round(tenure_months, 1),
        "past_advance_count":     past_advance_count,
        "on_time_repayment_rate": round(on_time_repayment_rate, 4),
        "dept_attrition_rate":    round(dept_attrition_rate, 4),
        "performance_score":      performance_score,
        "has_active_advance":     has_active_advance,
        "days_since_last_advance": days_since_last_advance,
        "existing_debt_ratio":    round(existing_debt_ratio, 4),
        "requested_amount_pct":   round(requested_amount_pct, 2),
    }

    if include_label:
        row["true_max_pct"] = _ground_truth(row, rng)

    return row


# ---------------------------------------------------------------------------
# Ground-truth formula
# ---------------------------------------------------------------------------

def _ground_truth(row: dict, rng: np.random.Generator) -> float:
    """
    Rule-based label that XGBoost will learn to approximate.

    Linear factors:
      base      : how much of the month has passed (Wagestream-style: cap is
                  proportional to earned pay, max ~30 pts at end of month)
      repay     : repayment track record          (-5 to +5 pts)
      debt      : penalise existing obligations   (0 to -10 pts)
      active    : hard block if advance active    (-8 pts)
      attrition : flight-risk penalty             (0 to -6 pts)
      perf      : performance bonus/penalty       (-3 to +3 pts)
      tenure    : loyalty bonus                   (0 to +5 pts)
      low_tier  : low earners (tier 0) get smaller cushion (-3 pts)

    Nonlinear cliffs (mirroring real EWA underwriting):
      probation_mult     : tenure < 3 months -> 0.3x (industry standard)
      high_debt_mult     : existing_debt_ratio > 0.5 -> 0.4x
      trust_bonus        : >=4 past advances + repay rate >= 0.9 -> +3 pts
      early_month_floor  : month_elapsed_pct < 0.10 -> hard cap at 5%
                           (you can't advance much salary on day 2)

    noise: Gaussian sigma=1.0, drawn from the row's deterministic rng.
    """
    base      = 30.0 * row["month_elapsed_pct"]
    repay     = 10.0 * (row["on_time_repayment_rate"] - 0.5)
    debt      = -10.0 * row["existing_debt_ratio"]
    active    = -8.0 * row["has_active_advance"]
    attrition = -6.0 * row["dept_attrition_rate"]
    perf      = 1.5  * (row["performance_score"] - 3.0)
    tenure    = min(row["tenure_months"], 60.0) / 60.0 * 5.0
    low_tier  = -3.0 if row["salary_tier"] == 0 else 0.0

    trust_bonus = 0.0
    if row["past_advance_count"] >= 4 and row["on_time_repayment_rate"] >= 0.9:
        trust_bonus = 3.0

    raw = base + repay + debt + active + attrition + perf + tenure + low_tier + trust_bonus
    raw += float(rng.normal(0, 1.0))

    # Multiplicative cliffs on the linear sum (only on the positive part)
    if row["tenure_months"] < 3.0:
        raw *= 0.3
    if row["existing_debt_ratio"] > 0.5:
        raw *= 0.4

    val = float(np.clip(raw, 0.0, 50.0))

    # Hard floor very early in the month: at most 5% can be advanced on day 1-3
    if row["month_elapsed_pct"] < 0.10:
        val = min(val, 5.0)

    return val


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------

def generate_training_data(n: int = 5_000, seed: int = 42) -> pd.DataFrame:
    """
    Returns a DataFrame of `n` synthetic employee-month rows.
    Columns include all 11 ML features plus `true_max_pct` label.
    Multiple months are simulated by jittering the reference date so
    `month_elapsed_pct` has a realistic range (not just today's value).
    Fully deterministic given `seed` (no global RNG state mutated).
    """
    base_today = date.today()
    offset_rng = _rng(seed)
    rows = []
    for i in range(n):
        # Jitter reference date +-180 days so month_elapsed_pct varies
        day_offset = int(offset_rng.integers(-180, 181))
        ref_date = base_today + timedelta(days=day_offset)
        # Per-row rng so rows are deterministic regardless of order
        row_rng = np.random.default_rng(seed + i * 37)
        row = _build_row(i, row_rng, ref_date, include_label=True)
        rows.append(row)

    return pd.DataFrame(rows)


def generate_sample_employees(n: int = 100, seed: int = 99) -> pd.DataFrame:
    """
    Returns n rows suitable for HR CSV upload.
    Columns match what csv_service.py expects:
      employee_code, full_name, department, salary_millimes, hire_date,
      performance_score, on_time_repayment_rate, past_advance_count,
      days_since_last_advance, has_active_advance, dept_attrition_rate,
      existing_debt_ratio, opted_in_wallet

    No ML label column — HR upload doesn't know ground truth.
    """
    today = date.today()
    rng = _rng(seed)
    rows = []
    for i in range(n):
        row_rng = np.random.default_rng(seed + i * 13)
        row = _build_row(i + 1, row_rng, today, include_label=False)
        # ~30% opt into wallet (matches seed.py note)
        row["opted_in_wallet"] = int(rng.random() < 0.30)
        # Drop internal ML context columns not in HR upload spec
        row.pop("month_elapsed_pct", None)
        row.pop("salary_tier", None)
        row.pop("tenure_months", None)
        row.pop("requested_amount_pct", None)
        rows.append(row)
    return pd.DataFrame(rows)


def generate_live_demo_employees(
    n: int = 16,
    seed: int = 101,
    mean_salary_tnd: float = 700.0,
    std_salary_tnd: float = 95.0,
    min_salary_tnd: float = 500.0,
    max_salary_tnd: float = 1000.0,
    wallet_opt_in_rate: float = 0.9,
) -> pd.DataFrame:
    """
    HR / Excel upload sheet for live demos: random realistic fields, salaries
    drawn from a normal around ``mean_salary_tnd`` (default 700 DT), clipped.
    Employee codes: DEMO-001 … DEMO-n. Most rows opt into wallet so advances work.
    """
    if not 10 <= n <= 20:
        raise ValueError("n should be between 10 and 20 for this demo export")
    today = date.today()
    rows = []
    for i in range(n):
        row_rng = np.random.default_rng(seed + i * 19 + 7_001)
        salary_tnd = float(
            np.clip(
                row_rng.normal(mean_salary_tnd, std_salary_tnd),
                min_salary_tnd,
                max_salary_tnd,
            )
        )
        salary_millimes = int(round(salary_tnd * 1000))
        row = _build_row(
            i + 1,
            row_rng,
            today,
            include_label=False,
            salary_millimes_override=salary_millimes,
        )
        row["employee_code"] = f"DEMO-{i + 1:03d}"
        row["opted_in_wallet"] = int(row_rng.random() < wallet_opt_in_rate)
        for k in (
            "month_elapsed_pct",
            "salary_tier",
            "tenure_months",
            "requested_amount_pct",
        ):
            row.pop(k, None)
        rows.append(row)
    return pd.DataFrame(rows)


# ---------------------------------------------------------------------------
# CLI usage: python ml/synth.py
# ---------------------------------------------------------------------------
if __name__ == "__main__":
    import argparse
    import pathlib

    parser = argparse.ArgumentParser(description="Generate Avanci synthetic data")
    parser.add_argument(
        "--live-demo-only",
        action="store_true",
        help="Only write live_demo_employees CSV/XLSX (fast).",
    )
    parser.add_argument(
        "--live-n",
        type=int,
        default=16,
        help="Rows for live demo (10-20, default 16).",
    )
    parser.add_argument(
        "--live-seed",
        type=int,
        default=101,
        help="RNG seed for live demo batch.",
    )
    args = parser.parse_args()

    out_dir = pathlib.Path(__file__).parent
    scripts_dir = out_dir.parent / "scripts"
    scripts_dir.mkdir(exist_ok=True)

    if args.live_demo_only:
        n_live = max(10, min(20, args.live_n))
        demo_df = generate_live_demo_employees(n=n_live, seed=args.live_seed)
        csv_path = scripts_dir / "live_demo_employees.csv"
        xlsx_path = scripts_dir / "live_demo_employees.xlsx"
        demo_df.to_csv(csv_path, index=False)
        demo_df.to_excel(xlsx_path, index=False)
        mean_dt = demo_df["salary_millimes"].mean() / 1000.0
        print(f"Live demo upload: {len(demo_df)} rows")
        print(f"  CSV  -> {csv_path}")
        print(f"  XLSX -> {xlsx_path}")
        print(f"  Mean salary: {mean_dt:.2f} TND  (min/max DT: {demo_df['salary_millimes'].min()/1000:.2f} / {demo_df['salary_millimes'].max()/1000:.2f})")
        raise SystemExit(0)

    print("Generating training data (5,000 rows)...")
    train_df = generate_training_data(n=5_000, seed=42)
    train_path = out_dir / "training_data.csv"
    train_df.to_csv(train_path, index=False)
    print(f"  Saved -> {train_path}  shape={train_df.shape}")
    print(
        f"  true_max_pct  mean={train_df['true_max_pct'].mean():.2f}  "
        f"std={train_df['true_max_pct'].std():.2f}  "
        f"min={train_df['true_max_pct'].min():.2f}  "
        f"max={train_df['true_max_pct'].max():.2f}"
    )
    zero_share = (train_df["true_max_pct"] == 0).mean()
    print(f"  share at floor (0%): {zero_share:.1%}")

    print("\nGenerating sample employees (100 rows)...")
    sample_df = generate_sample_employees(n=100, seed=99)
    sample_path = scripts_dir / "sample_employees.csv"
    sample_df.to_csv(sample_path, index=False)
    print(f"  Saved -> {sample_path}  shape={sample_df.shape}")

    n_live = max(10, min(20, args.live_n))
    demo_df = generate_live_demo_employees(n=n_live, seed=args.live_seed)
    live_csv = scripts_dir / "live_demo_employees.csv"
    live_xlsx = scripts_dir / "live_demo_employees.xlsx"
    demo_df.to_csv(live_csv, index=False)
    demo_df.to_excel(live_xlsx, index=False)
    mean_dt = demo_df["salary_millimes"].mean() / 1000.0
    print(f"\nLive demo upload ({len(demo_df)} rows, ~{mean_dt:.0f} DT mean):")
    print(f"  CSV  -> {live_csv}")
    print(f"  XLSX -> {live_xlsx}")

    print("\nDone.")
