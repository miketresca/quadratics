from typing import Literal

from app.schemas.common import ApiModel

InstructorId = Literal["male", "female"]


class Instructor(ApiModel):
    id: InstructorId
    display_name: str
    voice_provider: str | None = None
    voice_id: str | None = None
    avatar_provider: str | None = None
    avatar_id: str | None = None
