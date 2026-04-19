import enum
from datetime import date, datetime

from sqlalchemy import Date, DateTime, Enum, Float, ForeignKey, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db import Base


class AdvanceStatus(str, enum.Enum):
    pending = "pending"
    approved = "approved"
    rejected = "rejected"
    paid = "paid"


class AdvanceRequest(Base):
    __tablename__ = "advance_requests"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    employee_profile_id: Mapped[int] = mapped_column(ForeignKey("employee_profiles.id"), index=True)
    requested_amount_millimes: Mapped[int] = mapped_column(Integer)
    requested_payout_date: Mapped[date] = mapped_column(Date)
    status: Mapped[AdvanceStatus] = mapped_column(Enum(AdvanceStatus), default=AdvanceStatus.pending, index=True)
    model_recommended_pct: Mapped[float | None] = mapped_column(Float, nullable=True)
    model_recommended_amount_millimes: Mapped[int | None] = mapped_column(Integer, nullable=True)
    decided_by_user_id: Mapped[int | None] = mapped_column(ForeignKey("users.id"), nullable=True)
    decided_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    reject_reason: Mapped[str | None] = mapped_column(Text, nullable=True)
    # Intentionally no FK to ledger_entries (circular create order with SQLite).
    payout_ledger_entry_id: Mapped[int | None] = mapped_column(Integer, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    employee = relationship("EmployeeProfile", back_populates="advance_requests")
    decided_by = relationship("User", foreign_keys=[decided_by_user_id])
