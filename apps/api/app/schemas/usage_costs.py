from app.schemas.common import ApiModel


class UsageBreakdownItem(ApiModel):
    provider: str
    stage: str
    unit_type: str
    quantity: float
    cost_usd: float


class UsageSummary(ApiModel):
    user_total_cost_usd: float
    user_total_quantity: float
    user_breakdown: list[UsageBreakdownItem]
    global_average_cost_per_video_usd: float
    global_video_count: int
    global_breakdown: list[UsageBreakdownItem]


class UsageEventItem(ApiModel):
    id: str
    created_at: str
    generation_job_id: str | None
    provider: str
    stage: str
    model: str | None
    unit_type: str
    quantity: float
    unit_cost_usd: float
    cost_usd: float


class UsageEventsResponse(ApiModel):
    events: list[UsageEventItem]
