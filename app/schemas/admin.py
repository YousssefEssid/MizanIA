from pydantic import BaseModel, EmailStr, Field


class EmployerCreate(BaseModel):
    name: str = Field(min_length=1, max_length=255)


class EmployerResponse(BaseModel):
    id: int
    name: str
    country: str

    class Config:
        from_attributes = True


class HRAdminCreate(BaseModel):
    email: EmailStr
    password: str = Field(min_length=6, max_length=128)


class UserCreated(BaseModel):
    id: int
    email: str
