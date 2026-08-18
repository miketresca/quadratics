from typing import Literal

from app.schemas.common import ApiModel

ProviderKeyName = Literal["heygen"]


class ProviderKeyMetadata(ApiModel):
    provider: ProviderKeyName
    key_hint: str
    updated_at: str | None = None


class ProviderKeysResponse(ApiModel):
    keys: list[ProviderKeyMetadata]


class ProviderKeyUpsertRequest(ApiModel):
    provider: ProviderKeyName
    api_key: str
