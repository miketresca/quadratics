from app.schemas.common import ApiModel


class CurrentUserResponse(ApiModel):
    id: str
    email: str | None
    display_name: str | None = None
    credit_balance: int
