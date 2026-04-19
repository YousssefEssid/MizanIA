from datetime import date, datetime
from typing import Annotated

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile
from sqlalchemy.orm import Session

from app.db import get_db
from app.deps import require_roles
from app.models import (
    AdvanceRequest,
    AdvanceStatus,
    EmployeeProfile,
    EmployerPolicy,
    LedgerDirection,
    User,
    UserRole,
    WalletOwnerType,
)
from app.schemas.hr import (
    AdvanceDecision,
    AdvanceRequestHR,
    EmployeePolicyUpdate,
    EmployeePublic,
    EmployerPolicyOut,
    EmployerPolicyUpdate,
    PayrollLine,
    WalletFund,
)
from app.services import csv_service, employee_account_service, report_service
from app.services.ledger_service import append_entry
from app.services.ml_service import predict_max_pct
from app.services.transfer_service import execute_advance_payout, get_or_create_wallet

router = APIRouter(prefix="/hr", tags=["hr"])
HR = Annotated[User, Depends(require_roles(UserRole.hr_admin))]


def _employee_public(db: Session, row: EmployeeProfile) -> EmployeePublic:
    pol = db.query(EmployerPolicy).filter_by(employer_id=row.employer_id).first()
    g = pol.global_policy_max_pct if pol else None
    return EmployeePublic.model_validate(row).model_copy(update={"global_policy_max_pct": g})


def _employer_id(user: User) -> int:
    if not user.employer_id:
        raise HTTPException(status_code=400, detail="HR user missing employer")
    return user.employer_id


@router.get("/employees", response_model=list[EmployeePublic])
def list_employees(db: Annotated[Session, Depends(get_db)], user: HR):
    eid = _employer_id(user)
    rows = db.query(EmployeeProfile).filter_by(employer_id=eid).all()
    return [_employee_public(db, r) for r in rows]


@router.post("/employees/upload")
async def upload_employees(
    db: Annotated[Session, Depends(get_db)],
    user: HR,
    file: UploadFile = File(...),
):
    eid = _employer_id(user)
    raw = await file.read()
    try:
        df = csv_service.parse_upload(raw, file.filename or "upload.csv")
        df = csv_service.normalize_columns(df)
        result = csv_service.upsert_employees_from_dataframe(db, eid, df)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    return result


@router.post("/employees/score")
def score_employees(db: Annotated[Session, Depends(get_db)], user: HR):
    eid = _employer_id(user)
    today = date.today()
    profiles = db.query(EmployeeProfile).filter_by(employer_id=eid).all()
    for p in profiles:
        p.recommended_max_pct = predict_max_pct(p, today)
        p.last_scored_at = datetime.utcnow()
        db.add(p)
    acct = employee_account_service.ensure_employee_logins(db, eid, user.email)
    db.commit()
    return {"scored": len(profiles), **acct}


@router.get("/dashboard/eligibility")
def eligibility(
    db: Annotated[Session, Depends(get_db)],
    user: HR,
    min_pct: float = 0.0,
):
    eid = _employer_id(user)
    q = db.query(EmployeeProfile).filter(
        EmployeeProfile.employer_id == eid,
        EmployeeProfile.recommended_max_pct.isnot(None),
        EmployeeProfile.recommended_max_pct >= min_pct,
    )
    out = []
    for p in q.all():
        out.append(
            {
                "employee_profile_id": p.id,
                "employee_code": p.employee_code,
                "full_name": p.full_name,
                "recommended_max_pct": p.recommended_max_pct,
                "salary_millimes": p.salary_millimes,
                "opted_in_wallet": p.opted_in_wallet,
            }
        )
    return out


@router.get("/dashboard/requests", response_model=list[AdvanceRequestHR])
def list_requests(
    db: Annotated[Session, Depends(get_db)],
    user: HR,
    status: AdvanceStatus | None = None,
):
    eid = _employer_id(user)
    q = (
        db.query(AdvanceRequest)
        .join(EmployeeProfile)
        .filter(EmployeeProfile.employer_id == eid)
    )
    if status:
        q = q.filter(AdvanceRequest.status == status)
    q = q.order_by(AdvanceRequest.created_at.desc())
    result = []
    for r in q.all():
        emp = r.employee
        result.append(
            AdvanceRequestHR(
                id=r.id,
                employee_profile_id=r.employee_profile_id,
                employee_name=emp.full_name,
                requested_amount_millimes=r.requested_amount_millimes,
                requested_payout_date=r.requested_payout_date,
                status=r.status,
                model_recommended_pct=r.model_recommended_pct,
                model_recommended_amount_millimes=r.model_recommended_amount_millimes,
                created_at=r.created_at,
            )
        )
    return result


@router.post("/requests/{request_id}/approve")
def approve_request(
    request_id: int,
    db: Annotated[Session, Depends(get_db)],
    user: HR,
):
    eid = _employer_id(user)
    req = db.get(AdvanceRequest, request_id)
    if not req:
        raise HTTPException(status_code=404, detail="Request not found")
    emp = db.get(EmployeeProfile, req.employee_profile_id)
    if not emp or emp.employer_id != eid:
        raise HTTPException(status_code=404, detail="Request not found")
    if req.status != AdvanceStatus.pending:
        raise HTTPException(status_code=400, detail="Request is not pending")
    req.status = AdvanceStatus.approved
    req.decided_by_user_id = user.id
    req.decided_at = datetime.utcnow()
    db.add(req)
    db.flush()
    try:
        execute_advance_payout(db, req, eid)
    except ValueError as e:
        db.rollback()
        raise HTTPException(status_code=400, detail=str(e))
    db.commit()
    db.refresh(req)
    return {"id": req.id, "status": req.status.value, "payout_ledger_entry_id": req.payout_ledger_entry_id}


@router.post("/requests/{request_id}/reject")
def reject_request(
    request_id: int,
    body: AdvanceDecision,
    db: Annotated[Session, Depends(get_db)],
    user: HR,
):
    eid = _employer_id(user)
    req = db.get(AdvanceRequest, request_id)
    if not req:
        raise HTTPException(status_code=404, detail="Request not found")
    emp = db.get(EmployeeProfile, req.employee_profile_id)
    if not emp or emp.employer_id != eid:
        raise HTTPException(status_code=404, detail="Request not found")
    if req.status != AdvanceStatus.pending:
        raise HTTPException(status_code=400, detail="Request is not pending")
    req.status = AdvanceStatus.rejected
    req.decided_by_user_id = user.id
    req.decided_at = datetime.utcnow()
    req.reject_reason = body.reject_reason
    db.add(req)
    db.commit()
    return {"id": req.id, "status": req.status.value}


@router.get("/wallet")
def get_employer_wallet(db: Annotated[Session, Depends(get_db)], user: HR):
    from app.models import Wallet

    eid = _employer_id(user)
    w = get_or_create_wallet(db, WalletOwnerType.employer, eid)
    db.commit()
    w = db.query(Wallet).filter(Wallet.id == w.id).one()
    return {"employer_id": eid, "wallet_id": w.id, "balance_millimes": w.balance_millimes}


@router.post("/wallet/fund")
def fund_wallet(
    body: WalletFund,
    db: Annotated[Session, Depends(get_db)],
    user: HR,
):
    from app.models import Wallet

    eid = _employer_id(user)
    w = get_or_create_wallet(db, WalletOwnerType.employer, eid)
    wallet = db.query(Wallet).filter(Wallet.id == w.id).one()
    append_entry(db, wallet, LedgerDirection.credit, body.amount_millimes, None)
    db.commit()
    db.refresh(wallet)
    return {"employer_id": eid, "balance_millimes": wallet.balance_millimes}


def _get_or_create_policy(db: Session, employer_id: int) -> EmployerPolicy:
    p = db.query(EmployerPolicy).filter_by(employer_id=employer_id).first()
    if not p:
        p = EmployerPolicy(employer_id=employer_id, request_cutoff_day_of_month=None)
        db.add(p)
        db.flush()
    return p


@router.get("/policy", response_model=EmployerPolicyOut)
def get_policy(db: Annotated[Session, Depends(get_db)], user: HR):
    eid = _employer_id(user)
    p = _get_or_create_policy(db, eid)
    db.commit()
    return p


@router.put("/policy", response_model=EmployerPolicyOut)
def update_policy(
    body: EmployerPolicyUpdate,
    db: Annotated[Session, Depends(get_db)],
    user: HR,
):
    eid = _employer_id(user)
    p = _get_or_create_policy(db, eid)
    patch = body.model_dump(exclude_unset=True)
    if "request_cutoff_day_of_month" in patch:
        v = patch["request_cutoff_day_of_month"]
        if v is not None and (not isinstance(v, int) or v < 1 or v > 31):
            raise HTTPException(
                status_code=400,
                detail="Cut-off day must be an integer between 1 and 31, or null.",
            )
        p.request_cutoff_day_of_month = v
    if "global_policy_max_pct" in patch:
        p.global_policy_max_pct = patch["global_policy_max_pct"]
    db.add(p)
    db.commit()
    db.refresh(p)
    return p


@router.put("/employees/{employee_id}/policy", response_model=EmployeePublic)
def update_employee_policy(
    employee_id: int,
    body: EmployeePolicyUpdate,
    db: Annotated[Session, Depends(get_db)],
    user: HR,
):
    eid = _employer_id(user)
    emp = db.get(EmployeeProfile, employee_id)
    if not emp or emp.employer_id != eid:
        raise HTTPException(status_code=404, detail="Employee not found")
    pol = db.query(EmployerPolicy).filter_by(employer_id=eid).first()
    g = pol.global_policy_max_pct if pol else None
    if body.policy_max_pct is not None and emp.recommended_max_pct is not None:
        ceiling = float(emp.recommended_max_pct)
        if g is not None:
            ceiling = min(ceiling, float(g))
        if body.policy_max_pct > ceiling + 1e-6:
            raise HTTPException(
                status_code=400,
                detail=(
                    f"policy_max_pct ({body.policy_max_pct:.2f}%) exceeds the allowed "
                    f"ceiling ({ceiling:.2f}%) (model and employer policy)."
                ),
            )
    emp.policy_max_pct = body.policy_max_pct
    db.add(emp)
    db.commit()
    db.refresh(emp)
    return _employee_public(db, emp)


@router.get("/reports/payroll-deductions", response_model=list[PayrollLine])
def payroll_deductions(
    db: Annotated[Session, Depends(get_db)],
    user: HR,
    year: int | None = None,
    month: int | None = None,
):
    eid = _employer_id(user)
    today = date.today()
    y = year or today.year
    m = month or today.month
    rows = report_service.payroll_deductions_for_month(db, eid, y, m)
    return [PayrollLine(**r) for r in rows]
