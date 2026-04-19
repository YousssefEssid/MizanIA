from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.db import get_db
from app.deps import require_roles
from app.models import Employer, User, UserRole
from app.schemas.admin import EmployerCreate, EmployerResponse, HRAdminCreate, UserCreated
from app.security import hash_password

router = APIRouter(prefix="/admin", tags=["admin"])
Super = Annotated[User, Depends(require_roles(UserRole.superadmin))]


@router.post("/employers", response_model=EmployerResponse)
def create_employer(body: EmployerCreate, db: Annotated[Session, Depends(get_db)], _: Super):
    e = Employer(name=body.name)
    db.add(e)
    db.commit()
    db.refresh(e)
    return e


@router.post("/employers/{employer_id}/hr-admins", response_model=UserCreated)
def create_hr_admin(
    employer_id: int,
    body: HRAdminCreate,
    db: Annotated[Session, Depends(get_db)],
    _: Super,
):
    if not db.get(Employer, employer_id):
        raise HTTPException(status_code=404, detail="Employer not found")
    if db.query(User).filter(User.email == body.email).first():
        raise HTTPException(status_code=400, detail="Email already registered")
    u = User(
        email=body.email,
        password_hash=hash_password(body.password),
        role=UserRole.hr_admin,
        employer_id=employer_id,
    )
    db.add(u)
    db.commit()
    db.refresh(u)
    return UserCreated(id=u.id, email=u.email)
