from pydantic import BaseModel, EmailStr

from app.models import UserRole


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"


class LoginForm(BaseModel):
    username: str  # OAuth2 form uses username; we treat as email
    password: str


class MeResponse(BaseModel):
    id: int
    email: str
    role: UserRole
    employer_id: int | None
    employee_profile_id: int | None

    class Config:
        from_attributes = True
