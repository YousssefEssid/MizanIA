from sqlalchemy.orm import Session

from app.models import AdvanceRequest, AdvanceStatus, LedgerDirection, Wallet, WalletOwnerType
from app.services.ledger_service import append_entry


def get_or_create_wallet(db: Session, owner_type: WalletOwnerType, owner_id: int, currency: str = "TND") -> Wallet:
    w = db.query(Wallet).filter_by(owner_type=owner_type, owner_id=owner_id).first()
    if w:
        return w
    w = Wallet(owner_type=owner_type, owner_id=owner_id, currency=currency, balance_millimes=0)
    db.add(w)
    db.flush()
    return w


def execute_advance_payout(db: Session, request: AdvanceRequest, employer_id: int) -> None:
    if request.status != AdvanceStatus.approved:
        raise ValueError("Request must be approved before payout")
    emp_wallet = get_or_create_wallet(db, WalletOwnerType.employee, request.employee_profile_id)
    emp_wallet_row = db.query(Wallet).filter_by(id=emp_wallet.id).one()
    employer_wallet_row = db.query(Wallet).filter_by(
        owner_type=WalletOwnerType.employer, owner_id=employer_id
    ).one()
    amount = request.requested_amount_millimes
    if employer_wallet_row.balance_millimes < amount:
        raise ValueError("Insufficient employer wallet balance")

    debit = append_entry(
        db,
        employer_wallet_row,
        LedgerDirection.debit,
        amount,
        request.id,
    )
    credit = append_entry(
        db,
        emp_wallet_row,
        LedgerDirection.credit,
        amount,
        request.id,
    )
    request.status = AdvanceStatus.paid
    request.payout_ledger_entry_id = credit.id
    db.add(request)
