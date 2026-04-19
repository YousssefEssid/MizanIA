from datetime import date, datetime
from io import BytesIO

import pandas as pd
from sqlalchemy.orm import Session

from app.models import EmployeeProfile


def _parse_date(v) -> date:
    if isinstance(v, date) and not isinstance(v, datetime):
        return v
    if isinstance(v, datetime):
        return v.date()
    if pd.isna(v):
        raise ValueError("missing date")
    ts = pd.to_datetime(v, errors="coerce")
    if pd.isna(ts):
        raise ValueError(f"bad date: {v}")
    return ts.date()


def upsert_employees_from_dataframe(db: Session, employer_id: int, df: pd.DataFrame) -> dict:
    required = [
        "employee_code",
        "full_name",
        "department",
        "salary_millimes",
        "hire_date",
    ]
    for c in required:
        if c not in df.columns:
            raise ValueError(f"Missing column: {c}")

    created, updated, errors = 0, 0, []
    optional_defaults = {
        "performance_score": 3.0,
        "on_time_repayment_rate": 0.85,
        "past_advance_count": 0,
        "days_since_last_advance": 999,
        "has_active_advance": False,
        "dept_attrition_rate": 0.12,
        "existing_debt_ratio": 0.0,
        "opted_in_wallet": True,
    }

    for i, row in df.iterrows():
        try:
            code = str(row["employee_code"]).strip()
            data = {
                "full_name": str(row["full_name"]).strip(),
                "department": str(row["department"]).strip(),
                "salary_millimes": int(row["salary_millimes"]),
                "hire_date": _parse_date(row["hire_date"]),
            }
            for k, dflt in optional_defaults.items():
                data[k] = dflt if k not in df.columns or pd.isna(row.get(k)) else row[k]
            if "has_active_advance" in df.columns and not pd.isna(row.get("has_active_advance")):
                v = row["has_active_advance"]
                data["has_active_advance"] = bool(v) if not isinstance(v, str) else v.lower() in (
                    "1",
                    "true",
                    "yes",
                )
            if "opted_in_wallet" in df.columns and not pd.isna(row.get("opted_in_wallet")):
                v = row["opted_in_wallet"]
                data["opted_in_wallet"] = bool(v) if not isinstance(v, str) else v.lower() in (
                    "1",
                    "true",
                    "yes",
                )

            existing = (
                db.query(EmployeeProfile)
                .filter_by(employer_id=employer_id, employee_code=code)
                .first()
            )
            if existing:
                for k, v in data.items():
                    setattr(existing, k, v)
                updated += 1
            else:
                db.add(EmployeeProfile(employer_id=employer_id, employee_code=code, **data))
                created += 1
        except Exception as e:
            errors.append({"row": int(i) + 2, "error": str(e)})
    db.commit()
    return {"created": created, "updated": updated, "errors": errors}


def parse_upload(file_content: bytes, filename: str) -> pd.DataFrame:
    bio = BytesIO(file_content)
    lower = filename.lower()
    if lower.endswith(".xlsx") or lower.endswith(".xls"):
        return pd.read_excel(bio)
    return pd.read_csv(bio)


def normalize_columns(df: pd.DataFrame) -> pd.DataFrame:
    df = df.copy()
    df.columns = [str(c).strip().lower().replace(" ", "_") for c in df.columns]
    return df
