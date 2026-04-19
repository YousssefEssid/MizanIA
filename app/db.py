from sqlalchemy import create_engine, event
from sqlalchemy.orm import sessionmaker, DeclarativeBase

from app.config import settings


class Base(DeclarativeBase):
    pass


connect_args = {"check_same_thread": False} if settings.database_url.startswith("sqlite") else {}
engine = create_engine(settings.database_url, connect_args=connect_args)


@event.listens_for(engine, "connect")
def _sqlite_pragma(dbapi_connection, connection_record):
    if settings.database_url.startswith("sqlite"):
        cursor = dbapi_connection.cursor()
        cursor.execute("PRAGMA foreign_keys=ON")
        cursor.close()


SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def init_db():
    from app import models  # noqa: F401

    Base.metadata.create_all(bind=engine)
    _apply_lightweight_migrations()


def _apply_lightweight_migrations() -> None:
    """Add columns introduced after initial create_all on existing SQLite DBs.

    Real projects use Alembic; this keeps the demo zero-config across upgrades.
    """
    if not settings.database_url.startswith("sqlite"):
        return
    from sqlalchemy import inspect, text

    insp = inspect(engine)
    if "employee_profiles" in insp.get_table_names():
        cols = {c["name"] for c in insp.get_columns("employee_profiles")}
        with engine.begin() as conn:
            if "policy_max_pct" not in cols:
                conn.execute(text("ALTER TABLE employee_profiles ADD COLUMN policy_max_pct FLOAT"))
    if "employer_policies" in insp.get_table_names():
        pol_cols = {c["name"] for c in insp.get_columns("employer_policies")}
        with engine.begin() as conn:
            if "global_policy_max_pct" not in pol_cols:
                conn.execute(
                    text("ALTER TABLE employer_policies ADD COLUMN global_policy_max_pct FLOAT")
                )
