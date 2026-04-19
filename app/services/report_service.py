from calendar import monthrange
from datetime import date

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.models import AdvanceRequest, AdvanceStatus, EmployeeProfile


def payroll_deductions_for_month(db: Session, employer_id: int, year: int, month: int) -> list[dict]:
    _, last_day = monthrange(year, month)
    start = date(year, month, 1)
    end = date(year, month, last_day)

    q = (
        select(
            EmployeeProfile.id,
            EmployeeProfile.employee_code,
            EmployeeProfile.full_name,
            func.coalesce(
                func.sum(AdvanceRequest.requested_amount_millimes),
                0,
            ).label("total"),
        )
        .join(AdvanceRequest, AdvanceRequest.employee_profile_id == EmployeeProfile.id)
        .where(
            EmployeeProfile.employer_id == employer_id,
            AdvanceRequest.status == AdvanceStatus.paid,
            AdvanceRequest.decided_at.isnot(None),
            func.date(AdvanceRequest.decided_at) >= start,
            func.date(AdvanceRequest.decided_at) <= end,
        )
        .group_by(EmployeeProfile.id, EmployeeProfile.employee_code, EmployeeProfile.full_name)
    )
    rows = db.execute(q).all()
    return [
        {
            "employee_profile_id": r.id,
            "employee_code": r.employee_code,
            "full_name": r.full_name,
            "total_advanced_millimes": int(r.total),
        }
        for r in rows
    ]
