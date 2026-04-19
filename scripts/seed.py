"""
Bootstrap demo data: superadmin, employer, HR admin, employees, funded employer wallet.
Run from repo root: python scripts/seed.py
"""

from __future__ import annotations

import os
import sys
from datetime import date, datetime
from pathlib import Path

REPO = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(REPO))

from dotenv import load_dotenv

load_dotenv(REPO / ".env")

from app.db import SessionLocal, init_db
from app.models import (
    EmployeeProfile,
    Employer,
    LedgerDirection,
    User,
    UserRole,
    Wallet,
    WalletOwnerType,
)
from app.security import hash_password
from app.services.ledger_service import append_entry
from app.services.ml_service import predict_max_pct
from app.services.transfer_service import get_or_create_wallet


def main():
    init_db()
    db = SessionLocal()
    try:
        super_email = os.environ.get("SUPERADMIN_EMAIL", "super@avanci.tn")
        super_pass = os.environ.get("SUPERADMIN_PASSWORD", "superadmin123")

        existing_super = db.query(User).filter_by(email=super_email).first()
        if not existing_super:
            db.add(
                User(
                    email=super_email,
                    password_hash=hash_password(super_pass),
                    role=UserRole.superadmin,
                )
            )
            db.commit()
        else:
            existing_super.password_hash = hash_password(super_pass)
            existing_super.role = UserRole.superadmin
            db.add(existing_super)
            db.commit()

        emp = db.query(Employer).filter_by(name="Demo Tunis SARL").first()
        if not emp:
            emp = Employer(name="Demo Tunis SARL", country="TN")
            db.add(emp)
            db.commit()
            db.refresh(emp)

        hr_email = "hr@demo.tn"
        hr_user = db.query(User).filter_by(email=hr_email).first()
        if not hr_user:
            hr_user = User(
                email=hr_email,
                password_hash=hash_password("demo1234"),
                role=UserRole.hr_admin,
                employer_id=emp.id,
            )
            db.add(hr_user)
            db.commit()

        # Minimal employee roster if empty
        if db.query(EmployeeProfile).filter_by(employer_id=emp.id).count() == 0:
            samples = [
                ("TUN-001", "Amine Ben Salah", "Engineering", 3_200_000, date(2021, 3, 15)),
                ("TUN-002", "Sarra Mezzi", "Sales", 2_100_000, date(2022, 7, 1)),
                ("TUN-003", "Karim Trabelsi", "Support", 1_450_000, date(2023, 1, 10)),
                ("TUN-004", "Layla Haddad", "Finance", 4_800_000, date(2019, 11, 20)),
                ("TUN-005", "Oussama Gharbi", "Logistics", 1_900_000, date(2020, 5, 5)),
            ]
            for code, name, dept, sal, hired in samples:
                db.add(
                    EmployeeProfile(
                        employer_id=emp.id,
                        employee_code=code,
                        full_name=name,
                        department=dept,
                        salary_millimes=sal,
                        hire_date=hired,
                        performance_score=3.5,
                        on_time_repayment_rate=0.9,
                        past_advance_count=0,
                        days_since_last_advance=999,
                        has_active_advance=False,
                        dept_attrition_rate=0.1,
                        existing_debt_ratio=0.05,
                        opted_in_wallet=True,
                    )
                )
            db.commit()

        # Link first two employees to login accounts
        for idx, email in enumerate(["amine@demo.tn", "sarra@demo.tn"]):
            if db.query(User).filter_by(email=email).first():
                continue
            prof = (
                db.query(EmployeeProfile)
                .filter_by(employer_id=emp.id)
                .order_by(EmployeeProfile.id.asc())
                .offset(idx)
                .limit(1)
                .first()
            )
            if not prof:
                break
            u = User(
                email=email,
                password_hash=hash_password("employee123"),
                role=UserRole.employee,
                employer_id=emp.id,
                employee_profile_id=prof.id,
            )
            db.add(u)
        db.commit()

        # Fund employer wallet (50k TND)
        w = get_or_create_wallet(db, WalletOwnerType.employer, emp.id)
        wallet = db.query(Wallet).filter(Wallet.id == w.id).one()
        if wallet.balance_millimes < 50_000_000:
            need = 50_000_000 - wallet.balance_millimes
            append_entry(db, wallet, LedgerDirection.credit, need, None)
            db.commit()

        # Score employees
        today = date.today()
        for p in db.query(EmployeeProfile).filter_by(employer_id=emp.id).all():
            p.recommended_max_pct = predict_max_pct(p, today)
            p.last_scored_at = datetime.utcnow()
            db.add(p)
        db.commit()

        print("--- Avanci demo credentials ---")
        print(f"Superadmin: {super_email} / {super_pass}")
        print("HR: hr@demo.tn / demo1234")
        print("Employee: amine@demo.tn / employee123")
        print("Employee: sarra@demo.tn / employee123")
        print(f"Employer id: {emp.id} (fund wallet via POST /hr/wallet/fund if needed)")
    finally:
        db.close()


if __name__ == "__main__":
    main()
