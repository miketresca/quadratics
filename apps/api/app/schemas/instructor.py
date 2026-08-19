from app.schemas.common import ApiModel

InstructorId = str


class Instructor(ApiModel):
    id: InstructorId
    display_name: str
    voice_provider: str | None = None
    voice_id: str | None = None
    reference_image_url: str | None = None
    image_zoom: float = 1
    image_x: float = 50
    image_y: float = 50
    avatar_provider: str | None = None
    avatar_id: str | None = None


class InstructorCreateRequest(ApiModel):
    display_name: str
    voice_id: str | None = None
    avatar_id: str | None = None
    reference_image_url: str | None = None
    image_zoom: float = 1
    image_x: float = 50
    image_y: float = 50


class InstructorUpdateRequest(ApiModel):
    display_name: str
    voice_id: str | None = None
    avatar_id: str | None = None
    reference_image_url: str | None = None
    image_zoom: float = 1
    image_x: float = 50
    image_y: float = 50
