from __future__ import annotations

from dataclasses import dataclass, field
from datetime import UTC, datetime
from uuid import uuid4

import httpx

from app.core.config import Settings
from app.schemas.usage_costs import UsageBreakdownItem, UsageEventItem, UsageSummary


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

    async def events(self, user_id: str, *, limit: int = 50) -> list[UsageEventItem]:
        return _event_items(
            [
                event
                for event in sorted(self._events, key=lambda item: item.created_at, reverse=True)
                if event.user_id == user_id
            ][:limit]
        )


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
                        "user_id,generation_job_id,stage,provider,model,unit_type,"
                        "quantity,unit_cost_usd,cost_usd,metadata,created_at"
                    ),
                    "order": "created_at.desc",
                },
            )
        _raise_for_storage_error(response)
        events = [
            _event_from_row({"id": str(index), **row})
            for index, row in enumerate(response.json())
        ]
        return _summary_from_events(events, user_id=user_id)

    async def events(self, user_id: str, *, limit: int = 50) -> list[UsageEventItem]:
        async with httpx.AsyncClient() as client:
            response = await client.get(
                f"{self._base_url}/rest/v1/usage_events",
                headers=self._headers,
                params={
                    "user_id": f"eq.{user_id}",
                    "select": (
                        "id,user_id,generation_job_id,created_at,stage,provider,model,"
                        "unit_type,quantity,unit_cost_usd,cost_usd"
                    ),
                    "order": "created_at.desc",
                    "limit": str(limit),
                },
            )
        _raise_for_storage_error(response)
        return _event_items([_event_from_row(row) for row in response.json()])


def _summary_from_events(events: list[UsageCostEvent], *, user_id: str) -> UsageSummary:
    user_events = [event for event in events if event.user_id == user_id]
    generation_ids = {
        event.generation_job_id
        for event in events
        if event.generation_job_id is not None
    }
    average_by_paid_stage = _average_cost_by_paid_stage(events)
    average_without_avatar = sum(
        cost for stage, cost in average_by_paid_stage.items() if stage != "heygen_avatar"
    )
    average_with_avatar = average_without_avatar + average_by_paid_stage.get("heygen_avatar", 0)
    return UsageSummary(
        user_total_cost_usd=sum(event.cost_usd for event in user_events),
        user_total_quantity=sum(event.quantity for event in user_events),
        user_breakdown=_breakdown(user_events),
        global_average_cost_per_video_usd=average_without_avatar,
        global_average_cost_per_video_without_avatar_usd=average_without_avatar,
        global_average_cost_per_video_with_avatar_usd=average_with_avatar,
        global_video_count=len(generation_ids),
        global_breakdown=_breakdown(events),
    )


def _average_cost_by_paid_stage(events: list[UsageCostEvent]) -> dict[str, float]:
    by_generation_stage: dict[tuple[str, str], float] = {}
    for event in events:
        if event.generation_job_id is None:
            continue
        if event.stage == "heygen_avatar" and event.metadata.get("completeStage") is False:
            continue
        key = (event.generation_job_id, event.stage)
        by_generation_stage[key] = by_generation_stage.get(key, 0) + event.cost_usd

    stage_groups: dict[str, list[float]] = {}
    for (_generation_id, stage), cost in by_generation_stage.items():
        stage_groups.setdefault(stage, []).append(cost)
    return {
        stage: sum(costs) / len(costs)
        for stage, costs in stage_groups.items()
        if costs
    }


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


def _event_items(events: list[UsageCostEvent]) -> list[UsageEventItem]:
    return [
        UsageEventItem(
            id=event.id,
            created_at=event.created_at.isoformat(),
            generation_job_id=event.generation_job_id,
            provider=event.provider,
            stage=event.stage,
            model=event.model,
            unit_type=event.unit_type,
            quantity=event.quantity,
            unit_cost_usd=event.unit_cost_usd,
            cost_usd=event.cost_usd,
        )
        for event in events
    ]


def _event_from_row(row: dict[str, object]) -> UsageCostEvent:
    created_at = datetime.now(UTC)
    raw_created_at = row.get("created_at")
    if isinstance(raw_created_at, str):
        created_at = datetime.fromisoformat(raw_created_at.replace("Z", "+00:00"))
    return UsageCostEvent(
        id=str(row["id"]),
        user_id=str(row["user_id"]),
        generation_job_id=str(row["generation_job_id"]) if row.get("generation_job_id") else None,
        stage=str(row["stage"]),
        provider=str(row["provider"]),
        model=str(row["model"]) if row.get("model") else None,
        unit_type=str(row["unit_type"]),
        quantity=float(row["quantity"] or 0),
        unit_cost_usd=float(row["unit_cost_usd"] or 0),
        cost_usd=float(row["cost_usd"] or 0),
        metadata=dict(row.get("metadata") or {}),
        created_at=created_at,
    )


def _raise_for_storage_error(response: httpx.Response) -> None:
    if response.is_success:
        return
    raise UsageCostStorageError(f"Usage cost storage request failed: {response.status_code}")


UsageCostRepository = InMemoryUsageCostRepository | SupabaseUsageCostRepository
