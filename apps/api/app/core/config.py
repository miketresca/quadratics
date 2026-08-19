import json
from functools import lru_cache
from typing import Annotated

from pydantic import Field, field_validator
from pydantic_settings import BaseSettings, NoDecode, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    supabase_url: str = ""
    supabase_anon_key: str = ""
    supabase_service_role_key: str = ""
    supabase_jwt_secret: str = ""
    supabase_jwks_url: str = ""
    default_generation_credits: int = 20
    allowed_origins: Annotated[list[str], NoDecode] = Field(
        default_factory=lambda: [
            "http://localhost:3000",
            "http://localhost:3001",
            "http://localhost:3010",
            "http://localhost:3011",
            "http://localhost:3012",
            "http://127.0.0.1:3000",
            "http://127.0.0.1:3001",
            "http://127.0.0.1:3010",
            "http://127.0.0.1:3011",
            "http://127.0.0.1:3012",
        ]
    )
    app_environment: str = "production"
    golden_checkpoint_reuse_enabled: bool = False
    openai_api_key: str = ""
    openai_script_model: str = "gpt-5-mini"
    script_generation_enabled: bool = False
    script_word_budget: int = 150
    provider_keys_encryption_key: str = ""
    elevenlabs_api_key: str = ""
    elevenlabs_model_id: str = "eleven_multilingual_v2"
    elevenlabs_cost_per_credit_usd: float = 99 / 600_000
    openai_gpt5_mini_input_cost_per_million_tokens_usd: float = 0.25
    openai_gpt5_mini_output_cost_per_million_tokens_usd: float = 2.00
    heygen_api_key: str = ""
    heygen_avatar_default_model: str = "avatar_iii"
    heygen_avatar_iii_cost_per_second_usd: float = 0.0167
    heygen_avatar_iv_cost_per_second_usd: float = 0.0667
    heygen_avatar_v_cost_per_second_usd: float = 0.0667
    heygen_avatar_cost_per_second_usd: float = 0.0167
    heygen_avatar_output_format: str = "webm"
    heygen_avatar_poll_interval_seconds: float = 10
    heygen_avatar_timeout_seconds: float = 300
    generated_media_bucket: str = "generated-media"
    motion_canvas_render_command: str = ""
    motion_canvas_render_cwd: str = ""
    motion_canvas_render_timeout_seconds: int = 120

    @field_validator("allowed_origins", mode="before")
    @classmethod
    def parse_allowed_origins(cls, value: object) -> object:
        if not isinstance(value, str):
            return value
        stripped = value.strip()
        if not stripped:
            return []
        if stripped.startswith("["):
            parsed = json.loads(stripped)
            if not isinstance(parsed, list):
                raise ValueError("ALLOWED_ORIGINS JSON must be a list")
            return parsed
        return [
            _strip_wrapping_quotes(origin.strip())
            for origin in stripped.split(",")
            if origin.strip()
        ]


@lru_cache
def get_settings() -> Settings:
    return Settings()


def _strip_wrapping_quotes(value: str) -> str:
    if len(value) >= 2 and value[0] == value[-1] and value[0] in {"'", '"'}:
        return value[1:-1]
    return value
