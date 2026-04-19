from datetime import date, datetime

from sqlalchemy import Boolean, Date, DateTime, Float, ForeignKey, Integer, String, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db import Base


class EmployeeProfile(Base):
    __tablename__ = "employee_profiles"
    __table_args__ = (UniqueConstraint("employer_id", "employee_code", name="uq_emp_code_employer"),)

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    employer_id: Mapped[int] = mapped_column(ForeignKey("employers.id"), index=True)
    employee_code: Mapped[str] = mapped_column(String(64), index=True)
    full_name: Mapped[str] = mapped_column(String(255))
    department: Mapped[str] = mapped_column(String(128))
    salary_millimes: Mapped[int] = mapped_column(Integer)
    hire_date: Mapped[date] = mapped_column(Date)
    performance_score: Mapped[float] = mapped_column(Float, default=3.0)
    on_time_repayment_rate: Mapped[float] = mapped_column(Float, default=0.85)
    past_advance_count: Mapped[int] = mapped_column(Integer, default=0)
    days_since_last_advance: Mapped[int] = mapped_column(Integer, default=999)
    has_active_advance: Mapped[bool] = mapped_column(Boolean, default=False)
    dept_attrition_rate: Mapped[float] = mapped_column(Float, default=0.12)
    existing_debt_ratio: Mapped[float] = mapped_column(Float, default=0.0)
    recommended_max_pct: Mapped[float | None] = mapped_column(Float, nullable=True)
    last_scored_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    opted_in_wallet: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    employer = relationship("Employer", back_populates="employees")
    user = relationship("User", back_populates="employee_profile", foreign_keys="User.employee_profile_id")
    advance_requests = relationship("AdvanceRequest", back_populates="employee")
