from app.schemas.common import ApiModel


class GameUsageBreakdownItem(ApiModel):
    provider: str
    stage: str
    unit_type: str
    quantity: float
    cost_usd: float


class GameUsageSummary(ApiModel):
    user_total_cost_usd: float
    user_total_quantity: float
    user_breakdown: list[GameUsageBreakdownItem]
    global_average_cost_per_lesson_usd: float
    global_completed_lesson_count: int
    global_breakdown: list[GameUsageBreakdownItem]


class GameUsageEventItem(ApiModel):
    id: str
    created_at: str
    run_id: str | None
    artifact_id: str | None
    provider: str
    stage: str
    model: str | None
    unit_type: str
    quantity: float
    unit_cost_usd: float
    total_cost_usd: float


class GameUsageEventsResponse(ApiModel):
    events: list[GameUsageEventItem]
