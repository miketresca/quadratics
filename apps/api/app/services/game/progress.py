from __future__ import annotations

from dataclasses import dataclass
from datetime import UTC, datetime
from typing import Any, Protocol

import httpx

from app.core.config import Settings
from app.schemas.game import GameLessonProgress, GameProgress
from app.services.game.catalog import get_lesson, is_allowed_fighter


class GameProgressError(RuntimeError):
    pass


class GameProgressStorageError(GameProgressError):
    pass


class InvalidGameProgressAction(GameProgressError):
    pass


class GameProgressRepository(Protocol):
    async def get(self, user_id: str) -> GameProgress: ...

    async def select_fighter(self, user_id: str, fighter_id: str) -> GameProgress: ...

    async def start_lesson(self, user_id: str, lesson_id: str) -> GameProgress: ...

    async def complete_lesson(self, user_id: str, lesson_id: str) -> GameProgress: ...

    async def reset(self, user_id: str) -> GameProgress: ...


@dataclass
class _StoredProgress:
    selected_fighter_id: str | None
    lessons: dict[str, GameLessonProgress]


class InMemoryGameProgressRepository:
    def __init__(self) -> None:
        self._users: dict[str, _StoredProgress] = {}

    async def get(self, user_id: str) -> GameProgress:
        return _to_response(self._users.get(user_id, _StoredProgress(None, {})))

    async def select_fighter(self, user_id: str, fighter_id: str) -> GameProgress:
        _validate_fighter(fighter_id)
        stored = self._users.setdefault(user_id, _StoredProgress(None, {}))
        stored.selected_fighter_id = fighter_id
        return _to_response(stored)

    async def start_lesson(self, user_id: str, lesson_id: str) -> GameProgress:
        _validate_unlocked_lesson(lesson_id)
        stored = self._users.setdefault(user_id, _StoredProgress(None, {}))
        now = _now()
        current = stored.lessons.get(lesson_id)
        if current and current.status == "completed":
            return _to_response(stored)
        stored.lessons[lesson_id] = GameLessonProgress(
            lesson_id=lesson_id,
            status="started",
            started_at=current.started_at if current else now,
        )
        return _to_response(stored)

    async def complete_lesson(self, user_id: str, lesson_id: str) -> GameProgress:
        _validate_unlocked_lesson(lesson_id)
        stored = self._users.setdefault(user_id, _StoredProgress(None, {}))
        now = _now()
        current = stored.lessons.get(lesson_id)
        if current is None:
            raise InvalidGameProgressAction("Lesson has not been started")
        stored.lessons[lesson_id] = GameLessonProgress(
            lesson_id=lesson_id,
            status="completed",
            started_at=current.started_at,
            completed_at=now,
        )
        return _to_response(stored)

    async def reset(self, user_id: str) -> GameProgress:
        self._users.pop(user_id, None)
        return GameProgress()


class SupabaseGameProgressRepository:
    def __init__(self, settings: Settings) -> None:
        if not settings.supabase_url or not settings.supabase_service_role_key:
            raise GameProgressStorageError("Supabase game progress storage is not configured")
        self._base_url = settings.supabase_url.rstrip("/")
        self._headers = {
            "apikey": settings.supabase_service_role_key,
            "Authorization": f"Bearer {settings.supabase_service_role_key}",
            "Content-Type": "application/json",
        }

    async def get(self, user_id: str) -> GameProgress:
        progress = await self._get_user_progress(user_id)
        lessons = await self._get_lesson_progress(user_id)
        return GameProgress(
            selected_fighter_id=progress.get("selected_fighter_id") if progress else None,
            lessons=lessons,
        )

    async def select_fighter(self, user_id: str, fighter_id: str) -> GameProgress:
        _validate_fighter(fighter_id)
        await self._upsert_user_progress(user_id, {"selected_fighter_id": fighter_id})
        return await self.get(user_id)

    async def start_lesson(self, user_id: str, lesson_id: str) -> GameProgress:
        _validate_unlocked_lesson(lesson_id)
        current = await self._get_one_lesson_progress(user_id, lesson_id)
        if current and current.status == "completed":
            return await self.get(user_id)
        now = _now()
        await self._upsert_lesson_progress(
            user_id,
            lesson_id,
            {
                "status": "started",
                "started_at": current.started_at if current else now,
                "completed_at": None,
                "source": "game_sprint_1",
            },
        )
        return await self.get(user_id)

    async def complete_lesson(self, user_id: str, lesson_id: str) -> GameProgress:
        _validate_unlocked_lesson(lesson_id)
        current = await self._get_one_lesson_progress(user_id, lesson_id)
        if current is None:
            raise InvalidGameProgressAction("Lesson has not been started")
        now = _now()
        await self._upsert_lesson_progress(
            user_id,
            lesson_id,
            {
                "status": "completed",
                "started_at": current.started_at,
                "completed_at": now,
                "source": "game_sprint_1",
            },
        )
        return await self.get(user_id)

    async def reset(self, user_id: str) -> GameProgress:
        async with httpx.AsyncClient() as client:
            lessons_response = await client.delete(
                f"{self._base_url}/rest/v1/game_user_lesson_progress",
                headers=self._headers,
                params={"user_id": f"eq.{user_id}"},
            )
            progress_response = await client.delete(
                f"{self._base_url}/rest/v1/game_user_progress",
                headers=self._headers,
                params={"user_id": f"eq.{user_id}"},
            )
        _raise_for_storage_error(lessons_response)
        _raise_for_storage_error(progress_response)
        return GameProgress()

    async def _get_user_progress(self, user_id: str) -> dict[str, Any] | None:
        async with httpx.AsyncClient() as client:
            response = await client.get(
                f"{self._base_url}/rest/v1/game_user_progress",
                headers=self._headers,
                params={
                    "user_id": f"eq.{user_id}",
                    "select": "selected_fighter_id",
                    "limit": "1",
                },
            )
        _raise_for_storage_error(response)
        rows = response.json()
        return rows[0] if rows else None

    async def _get_lesson_progress(self, user_id: str) -> list[GameLessonProgress]:
        async with httpx.AsyncClient() as client:
            response = await client.get(
                f"{self._base_url}/rest/v1/game_user_lesson_progress",
                headers=self._headers,
                params={
                    "user_id": f"eq.{user_id}",
                    "select": "lesson_id,status,started_at,completed_at",
                    "order": "created_at.asc",
                },
            )
        _raise_for_storage_error(response)
        return [GameLessonProgress.model_validate(row) for row in response.json()]

    async def _get_one_lesson_progress(
        self,
        user_id: str,
        lesson_id: str,
    ) -> GameLessonProgress | None:
        async with httpx.AsyncClient() as client:
            response = await client.get(
                f"{self._base_url}/rest/v1/game_user_lesson_progress",
                headers=self._headers,
                params={
                    "user_id": f"eq.{user_id}",
                    "lesson_id": f"eq.{lesson_id}",
                    "select": "lesson_id,status,started_at,completed_at",
                    "limit": "1",
                },
            )
        _raise_for_storage_error(response)
        rows = response.json()
        return GameLessonProgress.model_validate(rows[0]) if rows else None

    async def _upsert_user_progress(self, user_id: str, values: dict[str, Any]) -> None:
        payload = {"user_id": user_id, **values}
        async with httpx.AsyncClient() as client:
            response = await client.post(
                f"{self._base_url}/rest/v1/game_user_progress",
                headers={**self._headers, "Prefer": "resolution=merge-duplicates"},
                params={"on_conflict": "user_id"},
                json=payload,
            )
        _raise_for_storage_error(response)

    async def _upsert_lesson_progress(
        self,
        user_id: str,
        lesson_id: str,
        values: dict[str, Any],
    ) -> None:
        payload = {"user_id": user_id, "lesson_id": lesson_id, **values}
        async with httpx.AsyncClient() as client:
            response = await client.post(
                f"{self._base_url}/rest/v1/game_user_lesson_progress",
                headers={**self._headers, "Prefer": "resolution=merge-duplicates"},
                params={"on_conflict": "user_id,lesson_id"},
                json=payload,
            )
        _raise_for_storage_error(response)


def _validate_fighter(fighter_id: str) -> None:
    if not is_allowed_fighter(fighter_id):
        raise InvalidGameProgressAction("Unknown fighter")


def _validate_unlocked_lesson(lesson_id: str) -> None:
    lesson = get_lesson(lesson_id)
    if lesson is None:
        raise InvalidGameProgressAction("Unknown lesson")
    if lesson.locked:
        raise InvalidGameProgressAction("Lesson is locked")


def _to_response(progress: _StoredProgress) -> GameProgress:
    return GameProgress(
        selected_fighter_id=progress.selected_fighter_id,
        lessons=list(progress.lessons.values()),
    )


def _now() -> str:
    return datetime.now(UTC).isoformat()


def _raise_for_storage_error(response: httpx.Response) -> None:
    if response.is_success:
        return
    raise GameProgressStorageError(f"Game progress storage request failed: {response.status_code}")
