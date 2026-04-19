import enum
from datetime import datetime

from sqlalchemy import Boolean, DateTime, Enum, ForeignKey, Integer, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db import Base


class UserRole(str, enum.Enum):
    superadmin = "superadmin"
    hr_admin = "hr_admin"
    employee = "employee"


class User(Base):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    email: Mapped[str] = mapped_column(String(255), unique=True, index=True)
    password_hash: Mapped[str] = mapped_column(String(255))
    role: Mapped[UserRole] = mapped_column(Enum(UserRole), index=True)
    employer_id: Mapped[int | None] = mapped_column(ForeignKey("employers.id"), nullable=True)
    employee_profile_id: Mapped[int | None] = mapped_column(
        ForeignKey("employee_profiles.id"), nullable=True
    )
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    employer = relationship("Employer", back_populates="users", foreign_keys=[employer_id])
    employee_profile = relationship("EmployeeProfile", back_populates="user", foreign_keys=[employee_profile_id])
