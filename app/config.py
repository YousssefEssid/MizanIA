from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict

# Always resolve the default DB to the repo root (directory that contains `app/`), not the CWD.
# Otherwise `uvicorn` started from e.g. `frontend/` would use a different `avanci.db` and logins
# (including auto-created employees) would appear to "not work".
_REPO_ROOT = Path(__file__).resolve().parent.parent
_DEFAULT_SQLITE_URL = "sqlite:///" + (_REPO_ROOT / "avanci.db").resolve().as_posix()


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    secret_key: str = "dev-secret-change-in-production"
    access_token_expire_minutes: int = 60 * 24
    database_url: str = _DEFAULT_SQLITE_URL
    cors_origins: str = "*"


settings = Settings()
