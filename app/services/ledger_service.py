import hashlib
import json
from datetime import datetime, timezone

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models import LedgerDirection, LedgerEntry, Wallet

GENESIS_HASH = "0" * 64


def _canonical_payload(payload: dict) -> str:
    return json.dumps(payload, sort_keys=True, separators=(",", ":"))


def compute_hash(payload: dict, prev_hash: str) -> str:
    body = _canonical_payload(payload) + prev_hash
    return hashlib.sha256(body.encode("utf-8")).hexdigest()


def append_entry(
    db: Session,
    wallet: Wallet,
    direction: LedgerDirection,
    amount_millimes: int,
    related_request_id: int | None,
) -> LedgerEntry:
    last = db.scalars(
        select(LedgerEntry)
        .where(LedgerEntry.wallet_id == wallet.id)
        .order_by(LedgerEntry.id.desc())
        .limit(1)
    ).first()
    prev = last.entry_hash if last else GENESIS_HASH
    payload = {
        "wallet_id": wallet.id,
        "direction": direction.value,
        "amount_millimes": amount_millimes,
        "request_id": related_request_id,
        "ts": datetime.now(timezone.utc).isoformat(),
    }
    entry_hash = compute_hash(payload, prev)
    entry = LedgerEntry(
        wallet_id=wallet.id,
        direction=direction,
        amount_millimes=amount_millimes,
        related_request_id=related_request_id,
        prev_hash=prev,
        entry_hash=entry_hash,
        payload_json=_canonical_payload(payload),
    )
    db.add(entry)
    db.flush()
    if direction == LedgerDirection.debit:
        wallet.balance_millimes -= amount_millimes
    else:
        wallet.balance_millimes += amount_millimes
    return entry


def verify_wallet_chain(db: Session, wallet_id: int) -> dict:
    entries = db.scalars(
        select(LedgerEntry).where(LedgerEntry.wallet_id == wallet_id).order_by(LedgerEntry.id.asc())
    ).all()
    prev = GENESIS_HASH
    for e in entries:
        payload = json.loads(e.payload_json)
        expected = compute_hash(payload, e.prev_hash)
        if expected != e.entry_hash or e.prev_hash != prev:
            return {"ok": False, "broken_at_entry_id": e.id}
        prev = e.entry_hash
    return {"ok": True, "entry_count": len(entries)}
