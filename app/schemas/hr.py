from datetime import date, datetime

from pydantic import BaseModel, Field

from app.models import AdvanceStatus


class WalletFund(BaseModel):
    amount_millimes: int = Field(gt=0)


class AdvanceDecision(BaseModel):
    reject_reason: str | None = None


class EmployeeRow(BaseModel):
    employee_code: str
    full_name: str
    department: str
    salary_millimes: int = Field(gt=0)
    hire_date: date
    performance_score: float = Field(default=3.0, ge=1, le=5)
    on_time_repayment_rate: float = Field(default=0.85, ge=0, le=1)
    past_advance_count: int = Field(default=0, ge=0)
    days_since_last_advance: int = Field(default=999, ge=0)
    has_active_advance: bool = False
    dept_attrition_rate: float = Field(default=0.12, ge=0, le=1)
    existing_debt_ratio: float = Field(default=0.0, ge=0, le=1)
    opted_in_wallet: bool = True


class EmployeePublic(BaseModel):
    id: int
    employee_code: str
    full_name: str
    department: str
    salary_millimes: int
    recommended_max_pct: float | None
    policy_max_pct: float | None = None
    global_policy_max_pct: float | None = None
    last_scored_at: datetime | None
    opted_in_wallet: bool

    class Config:
        from_attributes = True


class EmployerPolicyOut(BaseModel):
    request_cutoff_day_of_month: int | None = None
    global_policy_max_pct: float | None = None

    class Config:
        from_attributes = True


class EmployerPolicyUpdate(BaseModel):
    request_cutoff_day_of_month: int | None = Field(default=None, ge=1, le=31)
    global_policy_max_pct: float | None = Field(default=None, ge=0, le=100)


class EmployeePolicyUpdate(BaseModel):
    """HR override of per-employee max-advance percentage.

    Must be in [0, recommended_max_pct]. Pass null to clear the override and
    fall back to the model's recommendation.
    """

    policy_max_pct: float | None = Field(default=None, ge=0, le=100)


class AdvanceRequestHR(BaseModel):
    id: int
    employee_profile_id: int
    employee_name: str
    requested_amount_millimes: int
    requested_payout_date: date
    status: AdvanceStatus
    model_recommended_pct: float | None
    model_recommended_amount_millimes: int | None
    created_at: datetime

    class Config:
        from_attributes = True


class PayrollLine(BaseModel):
    employee_profile_id: int
    employee_code: str
    full_name: str
    total_advanced_millimes: int
