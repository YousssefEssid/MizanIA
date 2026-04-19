import os
from calendar import monthrange
from datetime import date, datetime
from pathlib import Path

import numpy as np

from app.models import EmployeeProfile

FEATURE_NAMES = [
    "month_elapsed_pct",
    "salary_tier",
    "tenure_months",
    "past_advance_count",
    "on_time_repayment_rate",
    "dept_attrition_rate",
    "performance_score",
    "has_active_advance",
    "days_since_last_advance",
    "existing_debt_ratio",
    "requested_amount_pct",
]

_MODEL = None
_MODEL_KIND = None  # "xgboost" | "sklearn" | None


def _salary_tier(salary_millimes: int) -> float:
    tnd = salary_millimes / 1000.0
    if tnd < 1500:
        return 0.0
    if tnd < 3500:
        return 1.0
    return 2.0


def _tenure_months(hire_date: date, today: date) -> float:
    d0 = datetime(hire_date.year, hire_date.month, hire_date.day)
    d1 = datetime(today.year, today.month, today.day)
    return max(0.0, (d1 - d0).days / 30.44)


def _month_elapsed_pct(today: date) -> float:
    _, dim = monthrange(today.year, today.month)
    return min(1.0, today.day / float(dim))


def build_features(
    profile: EmployeeProfile, today: date | None = None, requested_amount_pct: float = 0.0
) -> np.ndarray:
    today = today or date.today()
    x = np.array(
        [
            _month_elapsed_pct(today),
            _salary_tier(profile.salary_millimes),
            _tenure_months(profile.hire_date, today),
            float(profile.past_advance_count),
            profile.on_time_repayment_rate,
            profile.dept_attrition_rate,
            profile.performance_score,
            1.0 if profile.has_active_advance else 0.0,
            float(min(profile.days_since_last_advance, 365)),
            profile.existing_debt_ratio,
            float(requested_amount_pct),
        ],
        dtype=np.float32,
    )
    return x.reshape(1, -1)


def _rule_based_max_pct(profile: EmployeeProfile, today: date) -> float:
    m = _month_elapsed_pct(today)
    base = 30.0 * m
    base += 5.0 * (profile.on_time_repayment_rate - 0.5)
    base -= 8.0 if profile.has_active_advance else 0.0
    base -= 10.0 * profile.existing_debt_ratio
    base -= 6.0 * profile.dept_attrition_rate
    base += 1.5 * (profile.performance_score - 3.0)
    base += min(_tenure_months(profile.hire_date, today), 60.0) / 60.0 * 5.0
    return float(np.clip(base, 0.0, 50.0))


def _load_model():
    global _MODEL, _MODEL_KIND
    if _MODEL is not None:
        return
    root = Path(__file__).resolve().parents[2]
    model_path = root / "ml" / "model.json"
    if not model_path.exists():
        _MODEL_KIND = None
        return
    try:
        import xgboost as xgb

        m = xgb.XGBRegressor()
        m.load_model(str(model_path))
        _MODEL = m
        _MODEL_KIND = "xgboost"
        return
    except Exception:
        pass
    try:
        import joblib

        p = root / "ml" / "model.joblib"
        if p.exists():
            _MODEL = joblib.load(p)
            _MODEL_KIND = "sklearn"
    except Exception:
        _MODEL_KIND = None


def predict_max_pct(profile: EmployeeProfile, today: date | None = None) -> float:
    today = today or date.today()
    _load_model()
    if _MODEL is None:
        return _rule_based_max_pct(profile, today)
    X = build_features(profile, today, 0.0)
    try:
        pred = float(_MODEL.predict(X)[0])
        return float(np.clip(pred, 0.0, 50.0))
    except Exception:
        return _rule_based_max_pct(profile, today)


def score_request(
    profile: EmployeeProfile, requested_amount_millimes: int, today: date | None = None
) -> tuple[float, int, bool, str]:
    """Returns (recommended_max_pct, recommended_amount_millimes, eligible, note)."""
    today = today or date.today()
    salary = max(profile.salary_millimes, 1)
    req_pct = 100.0 * requested_amount_millimes / salary
    max_pct = predict_max_pct(profile, today)
    rec_amount = int(round(salary * max_pct / 100.0))
    eligible = requested_amount_millimes <= rec_amount and max_pct > 0.5
    note = f"Model cap ~{max_pct:.1f}% of monthly salary ({rec_amount / 1000:.3f} TND)."
    if not eligible:
        note += " Request exceeds recommended cap (HR may still decide)."
    return max_pct, rec_amount, eligible, note


def refresh_model_path():
    global _MODEL, _MODEL_KIND
    _MODEL = None
    _MODEL_KIND = None
    _load_model()
