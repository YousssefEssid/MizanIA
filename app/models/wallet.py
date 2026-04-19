import enum
from datetime import datetime

from sqlalchemy import DateTime, Enum, ForeignKey, Integer, String, Text, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db import Base


class WalletOwnerType(str, enum.Enum):
    employer = "employer"
    employee = "employee"


class LedgerDirection(str, enum.Enum):
    debit = "debit"
    credit = "credit"


class Wallet(Base):
    __tablename__ = "wallets"
    __table_args__ = (UniqueConstraint("owner_type", "owner_id", name="uq_wallet_owner"),)

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    owner_type: Mapped[WalletOwnerType] = mapped_column(Enum(WalletOwnerType), index=True)
    owner_id: Mapped[int] = mapped_column(Integer, index=True)
    currency: Mapped[str] = mapped_column(String(8), default="TND")
    balance_millimes: Mapped[int] = mapped_column(Integer, default=0)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    entries = relationship("LedgerEntry", back_populates="wallet", order_by="LedgerEntry.id")


class LedgerEntry(Base):
    __tablename__ = "ledger_entries"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    wallet_id: Mapped[int] = mapped_column(ForeignKey("wallets.id"), index=True)
    direction: Mapped[LedgerDirection] = mapped_column(Enum(LedgerDirection))
    amount_millimes: Mapped[int] = mapped_column(Integer)
    related_request_id: Mapped[int | None] = mapped_column(ForeignKey("advance_requests.id"), nullable=True)
    prev_hash: Mapped[str] = mapped_column(String(64))
    entry_hash: Mapped[str] = mapped_column(String(64), unique=True, index=True)
    payload_json: Mapped[str] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    wallet = relationship("Wallet", back_populates="entries")
