from __future__ import annotations

from dataclasses import dataclass, field
from datetime import UTC, datetime
from typing import Any, Protocol
from uuid import uuid4

import httpx

from app.core.config import Settings
from app.schemas.game_usage_costs import (
    GameUsageBreakdownItem,
    GameUsageEventItem,
    GameUsageSummary,
)


class GameUsageCostStorageError(RuntimeError):
    pass


@dataclass(frozen=True)
class GameUsageCostEvent:
    id: str
    user_id: str
    run_id: str | None
    artifact_id: str | None
    stage: str
    provider: str
    model: str | None
    unit_type: str
    quantity: float
    unit_cost_usd: float
    total_cost_usd: float
    metadata: dict[str, object] = field(default_factory=dict)
    created_at: datetime = field(default_factory=lambda: datetime.now(UTC))


class GameUsageCostRepository(Protocol):
    async def record(
        self,
        *,
        user_id: str,
        run_id: str | None,
        artifact_id: str | None,
        stage: str,
        provider: str,
        model: str | None,
        unit_type: str,
        quantity: float,
        unit_cost_usd: float,
        metadata: dict[str, object] | None = None,
    ) -> GameUsageCostEvent | None: ...

    async def summary(self, user_id: str) -> GameUsageSummary: ...

    async def events(self, user_id: str, *, limit: int = 50) -> list[GameUsageEventItem]: ...


class InMemoryGameUsageCostRepository:
    def __init__(self) -> None:
        self._events: list[GameUsageCostEvent] = []
        self._completed_run_ids: set[str] = set()

    def mark_completed_run(self, run_id: str) -> None:
        self._completed_run_ids.add(run_id)

    async def record(
        self,
        *,
        user_id: str,
        run_id: str | None,
        artifact_id: str | None,
        stage: str,
        provider: str,
        model: str | None,
        unit_type: str,
        quantity: float,
        unit_cost_usd: float,
        metadata: dict[str, object] | None = None,
    ) -> GameUsageCostEvent:
        normalized_quantity = max(quantity, 0)
        event = GameUsageCostEvent(
            id=str(uuid4()),
            user_id=user_id,
            run_id=run_id,
            artifact_id=artifact_id,
            stage=stage,
            provider=provider,
            model=model,
            unit_type=unit_type,
            quantity=normalized_quantity,
            unit_cost_usd=unit_cost_usd,
            total_cost_usd=normalized_quantity * unit_cost_usd,
            metadata=metadata or {},
        )
        self._events.append(event)
        return event

    async def summary(self, user_id: str) -> GameUsageSummary:
        return _summary_from_events(
            self._events,
            user_id=user_id,
            completed_run_ids=self._completed_run_ids,
        )

    async def events(self, user_id: str, *, limit: int = 50) -> list[GameUsageEventItem]:
        return _event_items(
            [
                event
                for event in sorted(self._events, key=lambda item: item.created_at, reverse=True)
                if event.user_id == user_id
            ][:limit]
        )


class SupabaseGameUsageCostRepository:
    def __init__(self, settings: Settings) -> None:
        if not settings.supabase_url or not settings.supabase_service_role_key:
            raise GameUsageCostStorageError("Supabase game usage cost storage is not configured")
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
        run_id: str | None,
        artifact_id: str | None,
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
            "run_id": run_id,
            "artifact_id": artifact_id,
            "stage": stage,
            "provider": provider,
            "model": model,
            "unit_type": unit_type,
            "quantity": normalized_quantity,
            "unit_cost_usd": unit_cost_usd,
            "total_cost_usd": normalized_quantity * unit_cost_usd,
            "metadata": metadata or {},
        }
        async with httpx.AsyncClient() as client:
            response = await client.post(
                f"{self._base_url}/rest/v1/game_usage_events",
                headers=self._headers,
                json=payload,
            )
        _raise_for_storage_error(response)

    async def summary(self, user_id: str) -> GameUsageSummary:
        async with httpx.AsyncClient() as client:
            events_response = await client.get(
                f"{self._base_url}/rest/v1/game_usage_events",
                headers=self._headers,
                params={
                    "select": (
                        "id,user_id,run_id,artifact_id,created_at,stage,provider,model,"
                        "unit_type,quantity,unit_cost_usd,total_cost_usd,metadata"
                    ),
                    "order": "created_at.desc",
                },
            )
            completed_response = await client.get(
                f"{self._base_url}/rest/v1/game_worksheet_runs",
                headers=self._headers,
                params={"status": "eq.completed", "select": "id"},
            )
        _raise_for_storage_error(events_response)
        _raise_for_storage_error(completed_response)
        completed_run_ids = {str(row["id"]) for row in completed_response.json()}
        return _summary_from_events(
            [_event_from_row(row) for row in events_response.json()],
            user_id=user_id,
            completed_run_ids=completed_run_ids,
        )

    async def events(self, user_id: str, *, limit: int = 50) -> list[GameUsageEventItem]:
        async with httpx.AsyncClient() as client:
            response = await client.get(
                f"{self._base_url}/rest/v1/game_usage_events",
                headers=self._headers,
                params={
                    "user_id": f"eq.{user_id}",
                    "select": (
                        "id,user_id,run_id,artifact_id,created_at,stage,provider,model,"
                        "unit_type,quantity,unit_cost_usd,total_cost_usd,metadata"
                    ),
                    "order": "created_at.desc",
                    "limit": str(limit),
                },
            )
        _raise_for_storage_error(response)
        return _event_items([_event_from_row(row) for row in response.json()])


def _summary_from_events(
    events: list[GameUsageCostEvent],
    *,
    completed_run_ids: set[str],
    user_id: str,
) -> GameUsageSummary:
    user_events = [event for event in events if event.user_id == user_id]
    completed_run_costs: dict[str, float] = {}
    for event in events:
        if event.run_id is None or event.run_id not in completed_run_ids:
            continue
        completed_run_costs[event.run_id] = completed_run_costs.get(event.run_id, 0) + event.total_cost_usd
    average = (
        sum(completed_run_costs.values()) / len(completed_run_costs)
        if completed_run_costs
        else 0
    )
    return GameUsageSummary(
        user_total_cost_usd=sum(event.total_cost_usd for event in user_events),
        user_total_quantity=sum(event.quantity for event in user_events),
        user_breakdown=_breakdown(user_events),
        global_average_cost_per_lesson_usd=average,
        global_completed_lesson_count=len(completed_run_costs),
        global_breakdown=_breakdown(events),
    )


def _breakdown(events: list[GameUsageCostEvent]) -> list[GameUsageBreakdownItem]:
    grouped: dict[tuple[str, str, str], tuple[float, float]] = {}
    for event in events:
        key = (event.provider, event.stage, event.unit_type)
        quantity, cost = grouped.get(key, (0.0, 0.0))
        grouped[key] = (quantity + event.quantity, cost + event.total_cost_usd)
    return [
        GameUsageBreakdownItem(
            provider=provider,
            stage=stage,
            unit_type=unit_type,
            quantity=quantity,
            cost_usd=cost,
        )
        for (provider, stage, unit_type), (quantity, cost) in sorted(grouped.items())
    ]


def _event_items(events: list[GameUsageCostEvent]) -> list[GameUsageEventItem]:
    return [
        GameUsageEventItem(
            id=event.id,
            created_at=event.created_at.isoformat(),
            run_id=event.run_id,
            artifact_id=event.artifact_id,
            provider=event.provider,
            stage=event.stage,
            model=event.model,
            unit_type=event.unit_type,
            quantity=event.quantity,
            unit_cost_usd=event.unit_cost_usd,
            total_cost_usd=event.total_cost_usd,
        )
        for event in events
    ]


def _event_from_row(row: dict[str, Any]) -> GameUsageCostEvent:
    created_at = datetime.now(UTC)
    raw_created_at = row.get("created_at")
    if isinstance(raw_created_at, str):
        created_at = datetime.fromisoformat(raw_created_at.replace("Z", "+00:00"))
    return GameUsageCostEvent(
        id=str(row["id"]),
        user_id=str(row["user_id"]),
        run_id=str(row["run_id"]) if row.get("run_id") else None,
        artifact_id=str(row["artifact_id"]) if row.get("artifact_id") else None,
        stage=str(row["stage"]),
        provider=str(row["provider"]),
        model=str(row["model"]) if row.get("model") else None,
        unit_type=str(row["unit_type"]),
        quantity=float(row["quantity"] or 0),
        unit_cost_usd=float(row["unit_cost_usd"] or 0),
        total_cost_usd=float(row["total_cost_usd"] or 0),
        metadata=dict(row.get("metadata") or {}),
        created_at=created_at,
    )


def _raise_for_storage_error(response: httpx.Response) -> None:
    if response.is_success:
        return
    raise GameUsageCostStorageError(f"Game usage cost storage request failed: {response.status_code}")
