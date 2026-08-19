from typing import Any, Literal

from pydantic import Field

from app.schemas.common import ApiModel

RealWorldContextStatus = Literal["completed", "unsupported", "failed"]


class RealWorldContext(ApiModel):
    """Short lesson enrichment shown beside the deterministic parabola explorer."""

    status: RealWorldContextStatus
    title: str = Field(default="", max_length=80)
    scenario: str = Field(default="", max_length=700)
    takeaway: str = Field(default="", max_length=240)
    unsupported_reason: str | None = None
    provider_metadata: dict[str, Any] = Field(default_factory=dict)
