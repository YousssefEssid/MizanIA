"""
Demo helper: after HR scores employees, ensure each profile has a login.

Emails use the HR user's company domain (part after @) and a local part derived from
employee_code. Password is fixed for the demo (see DEMO_EMPLOYEE_PASSWORD).
"""

from __future__ import annotations

import re

from sqlalchemy import func
from sqlalchemy.orm import Session

from app.models import EmployeeProfile, User, UserRole
from app.security import hash_password

DEMO_EMPLOYEE_PASSWORD = "123456"


def _domain_from_hr_email(hr_email: str) -> str:
    parts = hr_email.strip().split("@", 1)
    if len(parts) == 2 and parts[1].strip():
        return parts[1].lower().strip()
    return "demo.tn"


def _local_part_from_code(employee_code: str, profile_id: int) -> str:
    raw = (employee_code or "").strip().lower()
    if not raw:
        return f"emp{profile_id}"
    safe = re.sub(r"[^a-z0-9._-]+", "-", raw, flags=re.IGNORECASE)
    safe = re.sub(r"-{2,}", "-", safe).strip("-._") or f"emp{profile_id}"
    return safe[:64]


def _email_taken(db: Session, email: str) -> bool:
    e = email.strip().lower()
    return db.query(User).filter(func.lower(User.email) == e).first() is not None


def ensure_employee_logins(db: Session, employer_id: int, hr_email: str) -> dict:
    """
    For every EmployeeProfile under employer_id, create an employee User if none exists yet.
    Does not commit; caller commits.
    """
    domain = _domain_from_hr_email(hr_email)
    pwd_hash = hash_password(DEMO_EMPLOYEE_PASSWORD)
    created = 0
    already_linked = 0

    profiles = db.query(EmployeeProfile).filter_by(employer_id=employer_id).all()
    for p in profiles:
        linked = (
            db.query(User)
            .filter(
                User.employee_profile_id == p.id,
                User.role == UserRole.employee,
            )
            .first()
        )
        if linked:
            already_linked += 1
            continue

        local = _local_part_from_code(p.employee_code, p.id)
        domain_l = domain.lower()
        candidates = [
            f"{local}@{domain_l}",
            f"{local}.p{p.id}@{domain_l}",
            f"emp{p.id}.e{employer_id}@{domain_l}",
        ]
        email = None
        for cand in candidates:
            if not _email_taken(db, cand):
                email = cand
                break
        if email is None:
            continue

        db.add(
            User(
                email=email.lower(),
                password_hash=pwd_hash,
                role=UserRole.employee,
                employer_id=employer_id,
                employee_profile_id=p.id,
            )
        )
        created += 1
        db.flush()

    return {
        "employee_accounts_created": created,
        "employee_accounts_already_linked": already_linked,
    }
