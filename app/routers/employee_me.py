from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.db import get_db
from app.deps import require_roles
from app.models import AdvanceRequest, AdvanceStatus, EmployeeProfile, User, UserRole, WalletOwnerType
from app.schemas.employee import AdvanceCreate, AdvanceOut, ProfileOut, WalletOut
from app.services.ml_service import score_request
from app.services.transfer_service import get_or_create_wallet

router = APIRouter(prefix="/me", tags=["employee"])
Emp = Annotated[User, Depends(require_roles(UserRole.employee))]


def _profile(db: Session, user: User) -> EmployeeProfile:
    if not user.employee_profile_id:
        raise HTTPException(status_code=400, detail="No employee profile linked")
    p = db.get(EmployeeProfile, user.employee_profile_id)
    if not p:
        raise HTTPException(status_code=404, detail="Profile not found")
    return p


@router.get("/profile", response_model=ProfileOut)
def my_profile(db: Annotated[Session, Depends(get_db)], user: Emp):
    return _profile(db, user)


@router.get("/wallet")
def my_wallet(db: Annotated[Session, Depends(get_db)], user: Emp):
    from app.models import LedgerEntry, Wallet

    p = _profile(db, user)
    if not p.opted_in_wallet:
        raise HTTPException(status_code=400, detail="Wallet not enabled for this profile")
    w = get_or_create_wallet(db, WalletOwnerType.employee, p.id)
    db.commit()
    w = db.query(Wallet).filter(Wallet.id == w.id).one()
    wid = w.id
    recent = (
        db.query(LedgerEntry)
        .filter(LedgerEntry.wallet_id == w.id)
        .order_by(LedgerEntry.id.desc())
        .limit(25)
        .all()
    )
    return {
        "wallet_id": wid,
        "wallet": WalletOut(balance_millimes=w.balance_millimes, currency=w.currency),
        "recent": [
            {
                "id": e.id,
                "direction": e.direction.value,
                "amount_millimes": e.amount_millimes,
                "related_request_id": e.related_request_id,
                "entry_hash": e.entry_hash,
                "created_at": e.created_at.isoformat(),
            }
            for e in recent
        ],
    }


@router.get("/advances", response_model=list[AdvanceOut])
def list_advances(db: Annotated[Session, Depends(get_db)], user: Emp):
    p = _profile(db, user)
    rows = (
        db.query(AdvanceRequest)
        .filter_by(employee_profile_id=p.id)
        .order_by(AdvanceRequest.created_at.desc())
        .all()
    )
    return rows


@router.post("/advances")
def create_advance(
    body: AdvanceCreate,
    db: Annotated[Session, Depends(get_db)],
    user: Emp,
):
    p = _profile(db, user)
    if not p.opted_in_wallet:
        raise HTTPException(status_code=400, detail="Wallet not enabled for this profile")
    max_pct, rec_amt, eligible, note = score_request(p, body.amount_millimes, body.payout_date)
    req = AdvanceRequest(
        employee_profile_id=p.id,
        requested_amount_millimes=body.amount_millimes,
        requested_payout_date=body.payout_date,
        status=AdvanceStatus.pending,
        model_recommended_pct=max_pct,
        model_recommended_amount_millimes=rec_amt,
    )
    db.add(req)
    db.commit()
    db.refresh(req)
    return {
        "request_id": req.id,
        "status": req.status.value,
        "model_recommended_pct": max_pct,
        "model_recommended_amount_millimes": rec_amt,
        "within_model_cap": eligible,
        "note": note,
    }
