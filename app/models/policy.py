from datetime import datetime

from sqlalchemy import DateTime, Float, ForeignKey, Integer, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db import Base


class EmployerPolicy(Base):
    """Per-employer policy: cut-off day and optional global max-advance % cap."""

    __tablename__ = "employer_policies"
    __table_args__ = (UniqueConstraint("employer_id", name="uq_policy_employer"),)

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    employer_id: Mapped[int] = mapped_column(ForeignKey("employers.id"), index=True)
    request_cutoff_day_of_month: Mapped[int | None] = mapped_column(Integer, nullable=True)
    global_policy_max_pct: Mapped[float | None] = mapped_column(Float, nullable=True)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime, default=datetime.utcnow, onupdate=datetime.utcnow
    )

    employer = relationship("Employer")
