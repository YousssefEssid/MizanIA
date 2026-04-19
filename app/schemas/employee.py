from datetime import date, datetime

from pydantic import BaseModel, Field

from app.models import AdvanceStatus


class AdvanceCreate(BaseModel):
    amount_millimes: int = Field(gt=0)
    payout_date: date


class AdvanceOut(BaseModel):
    id: int
    requested_amount_millimes: int
    requested_payout_date: date
    status: AdvanceStatus
    model_recommended_pct: float | None
    model_recommended_amount_millimes: int | None
    created_at: datetime

    class Config:
        from_attributes = True


class ProfileOut(BaseModel):
    id: int
    full_name: str
    department: str
    salary_millimes: int
    recommended_max_pct: float | None

    class Config:
        from_attributes = True


class WalletOut(BaseModel):
    balance_millimes: int
    currency: str
