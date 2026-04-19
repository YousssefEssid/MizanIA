from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.db import get_db
from app.deps import get_current_user
from app.models import LedgerEntry, User, UserRole, Wallet, WalletOwnerType
from app.services.ledger_service import verify_wallet_chain

router = APIRouter(prefix="/wallets", tags=["wallets"])


def _can_view(user: User, wallet: Wallet) -> bool:
    if user.role == UserRole.superadmin:
        return True
    if user.role == UserRole.hr_admin and wallet.owner_type == WalletOwnerType.employer:
        return wallet.owner_id == user.employer_id
    if user.role == UserRole.employee and wallet.owner_type == WalletOwnerType.employee:
        return wallet.owner_id == user.employee_profile_id
    return False


@router.get("/{wallet_id}/ledger")
def wallet_ledger(
    wallet_id: int,
    db: Annotated[Session, Depends(get_db)],
    user: Annotated[User, Depends(get_current_user)],
    limit: int = 50,
):
    w = db.get(Wallet, wallet_id)
    if not w or not _can_view(user, w):
        raise HTTPException(status_code=404, detail="Wallet not found")
    lim = min(max(limit, 1), 200)
    rows = (
        db.query(LedgerEntry)
        .filter_by(wallet_id=w.id)
        .order_by(LedgerEntry.id.desc())
        .limit(lim)
        .all()
    )
    rows = list(reversed(rows))
    return {
        "wallet_id": w.id,
        "balance_millimes": w.balance_millimes,
        "entries": [
            {
                "id": e.id,
                "direction": e.direction.value,
                "amount_millimes": e.amount_millimes,
                "prev_hash": e.prev_hash,
                "entry_hash": e.entry_hash,
                "related_request_id": e.related_request_id,
                "created_at": e.created_at.isoformat(),
            }
            for e in rows
        ],
    }


@router.get("/{wallet_id}/verify-chain")
def verify_chain(
    wallet_id: int,
    db: Annotated[Session, Depends(get_db)],
    user: Annotated[User, Depends(get_current_user)],
):
    w = db.get(Wallet, wallet_id)
    if not w or not _can_view(user, w):
        raise HTTPException(status_code=404, detail="Wallet not found")
    return verify_wallet_chain(db, wallet_id)
