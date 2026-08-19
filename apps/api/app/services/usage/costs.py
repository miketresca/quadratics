from __future__ import annotations

from dataclasses import dataclass, field
from datetime import UTC, datetime
from uuid import uuid4

import httpx

from app.core.config import Settings
from app.schemas.usage_costs import UsageBreakdownItem, UsageSummary


class UsageCostStorageError(RuntimeError):
    pass


@dataclass(frozen=True)
class UsageCostEvent:
    id: str
    user_id: str
    generation_job_id: str | None
    stage: str
    provider: str
    model: str | None
    unit_type: str
    quantity: float
    unit_cost_usd: float
    cost_usd: float
    metadata: dict[str, object] = field(default_factory=dict)
    created_at: datetime = field(default_factory=lambda: datetime.now(UTC))


class InMemoryUsageCostRepository:
    def __init__(self) -> None:
        self._events: list[UsageCostEvent] = []

    async def record(
        self,
        *,
        user_id: str,
        generation_job_id: str | None,
        stage: str,
        provider: str,
        model: str | None,
        unit_type: str,
        quantity: float,
        unit_cost_usd: float,
        metadata: dict[str, object] | None = None,
    ) -> UsageCostEvent:
        normalized_quantity = max(quantity, 0)
        event = UsageCostEvent(
            id=str(uuid4()),
            user_id=user_id,
            generation_job_id=generation_job_id,
            stage=stage,
            provider=provider,
            model=model,
            unit_type=unit_type,
            quantity=normalized_quantity,
            unit_cost_usd=unit_cost_usd,
            cost_usd=normalized_quantity * unit_cost_usd,
            metadata=metadata or {},
        )
        self._events.append(event)
        return event

    async def summary(self, user_id: str) -> UsageSummary:
        return _summary_from_events(self._events, user_id=user_id)


class SupabaseUsageCostRepository:
    def __init__(self, settings: Settings) -> None:
        if not settings.supabase_url or not settings.supabase_service_role_key:
            raise UsageCostStorageError("Supabase usage cost storage is not configured")
        self._base_url = settings.supabase_url.rstrip("/")
        self._headers = {
            "apikey": settings.supabase_service_role_key,
            "Authorization": f"Bearer {settings.supabase_service_role_key}",
            "Content-Type": "application/json",
        }

    async def record(
        self,
        *,
        user_id: str,
        generation_job_id: str | None,
        stage: str,
        provider: str,
        model: str | None,
        unit_type: str,
        quantity: float,
        unit_cost_usd: float,
        metadata: dict[str, object] | None = None,
    ) -> None:
        normalized_quantity = max(quantity, 0)
        payload = {
            "user_id": user_id,
            "generation_job_id": generation_job_id,
            "stage": stage,
            "provider": provider,
            "model": model,
            "unit_type": unit_type,
            "quantity": normalized_quantity,
            "unit_cost_usd": unit_cost_usd,
            "cost_usd": normalized_quantity * unit_cost_usd,
            "metadata": metadata or {},
        }
        async with httpx.AsyncClient() as client:
            response = await client.post(
                f"{self._base_url}/rest/v1/usage_events",
                headers=self._headers,
                json=payload,
            )
        _raise_for_storage_error(response)

    async def summary(self, user_id: str) -> UsageSummary:
        async with httpx.AsyncClient() as client:
            response = await client.get(
                f"{self._base_url}/rest/v1/usage_events",
                headers=self._headers,
                params={
                    "select": (
                        "user_id,generation_job_id,stage,provider,unit_type,"
                        "quantity,cost_usd"
                    ),
                    "order": "created_at.desc",
                },
            )
        _raise_for_storage_error(response)
        events = [
            UsageCostEvent(
                id="remote",
                user_id=str(row["user_id"]),
                generation_job_id=str(row["generation_job_id"])
                if row.get("generation_job_id")
                else None,
                stage=str(row["stage"]),
                provider=str(row["provider"]),
                model=None,
                unit_type=str(row["unit_type"]),
                quantity=float(row["quantity"] or 0),
                unit_cost_usd=0,
                cost_usd=float(row["cost_usd"] or 0),
            )
            for row in response.json()
        ]
        return _summary_from_events(events, user_id=user_id)


def _summary_from_events(events: list[UsageCostEvent], *, user_id: str) -> UsageSummary:
    user_events = [event for event in events if event.user_id == user_id]
    generation_ids = {
        event.generation_job_id
        for event in events
        if event.generation_job_id is not None
    }
    global_total = sum(event.cost_usd for event in events)
    global_video_count = len(generation_ids)
    return UsageSummary(
        user_total_cost_usd=sum(event.cost_usd for event in user_events),
        user_total_quantity=sum(event.quantity for event in user_events),
        user_breakdown=_breakdown(user_events),
        global_average_cost_per_video_usd=(
            global_total / global_video_count if global_video_count else 0
        ),
        global_video_count=global_video_count,
        global_breakdown=_breakdown(events),
    )


def _breakdown(events: list[UsageCostEvent]) -> list[UsageBreakdownItem]:
    grouped: dict[tuple[str, str, str], tuple[float, float]] = {}
    for event in events:
        key = (event.provider, event.stage, event.unit_type)
        quantity, cost = grouped.get(key, (0.0, 0.0))
        grouped[key] = (quantity + event.quantity, cost + event.cost_usd)
    return [
        UsageBreakdownItem(
            provider=provider,
            stage=stage,
            unit_type=unit_type,
            quantity=quantity,
            cost_usd=cost,
        )
        for (provider, stage, unit_type), (quantity, cost) in sorted(grouped.items())
    ]


def _raise_for_storage_error(response: httpx.Response) -> None:
    if response.is_success:
        return
    raise UsageCostStorageError(f"Usage cost storage request failed: {response.status_code}")


UsageCostRepository = InMemoryUsageCostRepository | SupabaseUsageCostRepository
