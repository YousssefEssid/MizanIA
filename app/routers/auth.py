from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.db import get_db
from app.deps import get_current_user
from app.models import User
from app.schemas.auth import MeResponse, TokenResponse
from app.security import create_access_token, verify_password

router = APIRouter(prefix="/auth", tags=["auth"])


@router.post("/login", response_model=TokenResponse)
def login(
    db: Annotated[Session, Depends(get_db)],
    form: Annotated[OAuth2PasswordRequestForm, Depends()],
):
    login = (form.username or "").strip().lower()
    user = db.query(User).filter(func.lower(User.email) == login).first()
    if not user or not verify_password(form.password, user.password_hash):
        raise HTTPException(status_code=401, detail="Incorrect email or password")
    if not user.is_active:
        raise HTTPException(status_code=403, detail="Inactive user")
    token = create_access_token(
        str(user.id),
        {"role": user.role.value, "employer_id": user.employer_id},
    )
    return TokenResponse(access_token=token)


@router.get("/me", response_model=MeResponse)
def me(user: Annotated[User, Depends(get_current_user)]):
    return MeResponse(
        id=user.id,
        email=user.email,
        role=user.role,
        employer_id=user.employer_id,
        employee_profile_id=user.employee_profile_id,
    )
