"""
Train advance % regressor. Expects CSV at ml/training_data.csv (override with TRAINING_CSV).

Required columns (your 5k generator should output these):
  month_elapsed_pct, salary_tier, tenure_months, past_advance_count,
  on_time_repayment_rate, dept_attrition_rate, performance_score,
  has_active_advance, days_since_last_advance, existing_debt_ratio,
  requested_amount_pct, true_max_pct
"""

from __future__ import annotations

import os
import sys
from pathlib import Path

import numpy as np
import pandas as pd

ROOT = Path(__file__).resolve().parent
REPO = ROOT.parent
DEFAULT_CSV = ROOT / "training_data.csv"
MODEL_JSON = ROOT / "model.json"
MODEL_JOBLIB = ROOT / "model.joblib"


def _synth(feature_names: list[str], n: int = 800, seed: int = 42) -> pd.DataFrame:
    rng = np.random.default_rng(seed)
    rows = []
    for _ in range(n):
        m = float(rng.uniform(0.05, 1.0))
        st = float(rng.choice([0.0, 1.0, 2.0]))
        tenure = float(rng.uniform(0, 120))
        past = float(rng.integers(0, 8))
        repay = float(rng.uniform(0.4, 1.0))
        attr = float(rng.uniform(0.02, 0.35))
        perf = float(rng.uniform(1.0, 5.0))
        active = float(rng.choice([0.0, 1.0]))
        dsla = float(rng.integers(0, 400))
        debt = float(rng.uniform(0.0, 0.6))
        reqp = float(rng.uniform(0.0, 40.0))
        base = 30.0 * m
        base += 5.0 * (repay - 0.5)
        base -= 8.0 * active
        base -= 10.0 * debt
        base -= 6.0 * attr
        base += 1.5 * (perf - 3.0)
        base += min(tenure, 60.0) / 60.0 * 5.0
        y = float(np.clip(base + rng.normal(0, 2.0), 0.0, 50.0))
        rows.append([m, st, tenure, past, repay, attr, perf, active, dsla, debt, reqp, y])
    return pd.DataFrame(rows, columns=feature_names + ["true_max_pct"])


def main():
    sys.path.insert(0, str(REPO))
    from app.services.ml_service import FEATURE_NAMES

    path = Path(os.environ.get("TRAINING_CSV", str(DEFAULT_CSV)))
    if path.exists():
        df = pd.read_csv(path)
        print(f"Loaded {len(df)} rows from {path}")
    else:
        df = _synth(FEATURE_NAMES)
        print(f"No {path}; trained on {len(df)} synthetic rows (demo fallback).")

    missing = [c for c in FEATURE_NAMES + ["true_max_pct"] if c not in df.columns]
    if missing:
        raise SystemExit(f"CSV missing columns: {missing}")

    X = df[FEATURE_NAMES].astype(float).values
    y = df["true_max_pct"].astype(float).values

    try:
        import xgboost as xgb
        from sklearn.metrics import mean_absolute_error
        from sklearn.model_selection import train_test_split

        X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.15, random_state=42)
        reg = xgb.XGBRegressor(
            n_estimators=80,
            max_depth=4,
            learning_rate=0.08,
            subsample=0.9,
            colsample_bytree=0.9,
            objective="reg:squarederror",
            n_jobs=4,
        )
        reg.fit(X_train, y_train)
        pred = reg.predict(X_test)
        mae = mean_absolute_error(y_test, pred)
        print(f"XGBoost holdout MAE: {mae:.3f} (pct points)")
        reg.save_model(str(MODEL_JSON))
        if MODEL_JOBLIB.exists():
            MODEL_JOBLIB.unlink()
        print(f"Saved {MODEL_JSON}")
        return
    except Exception as e:
        print(f"XGBoost train failed ({e}); falling back to sklearn.")

    import joblib
    from sklearn.ensemble import HistGradientBoostingRegressor
    from sklearn.metrics import mean_absolute_error
    from sklearn.model_selection import train_test_split

    X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.15, random_state=42)
    reg = HistGradientBoostingRegressor(max_depth=6, learning_rate=0.08, max_iter=120, random_state=42)
    reg.fit(X_train, y_train)
    pred = reg.predict(X_test)
    mae = mean_absolute_error(y_test, pred)
    print(f"sklearn HGB holdout MAE: {mae:.3f} (pct points)")
    joblib.dump(reg, MODEL_JOBLIB)
    if MODEL_JSON.exists():
        MODEL_JSON.unlink()
    print(f"Saved {MODEL_JOBLIB}")


if __name__ == "__main__":
    main()
