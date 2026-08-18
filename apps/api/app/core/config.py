from functools import lru_cache

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    supabase_url: str = ""
    supabase_anon_key: str = ""
    supabase_service_role_key: str = ""
    supabase_jwt_secret: str = ""
    supabase_jwks_url: str = ""
    default_generation_credits: int = 20
    allowed_origins: list[str] = Field(default_factory=lambda: ["http://localhost:3000"])
    dev_auth_user_id: str = ""
    dev_auth_email: str = "dev@example.com"


@lru_cache
def get_settings() -> Settings:
    return Settings()
