from __future__ import annotations

from uuid import uuid4

import httpx

from app.core.config import Settings
from app.schemas.instructor import Instructor
from app.services.instructors.config import INSTRUCTORS


class InstructorStorageError(RuntimeError):
    pass


class InMemoryInstructorRepository:
    def __init__(self, instructors: list[Instructor] | None = None) -> None:
        self._instructors = list(instructors or INSTRUCTORS)

    async def list(self) -> list[Instructor]:
        return sorted(self._instructors, key=lambda instructor: instructor.display_name.lower())

    async def get(self, instructor_id: str | None) -> Instructor | None:
        if instructor_id is None:
            return self._instructors[0] if self._instructors else None
        return next(
            (
                instructor
                for instructor in self._instructors
                if instructor.id == instructor_id
            ),
            None,
        )

    async def create(
        self,
        *,
        display_name: str,
        voice_id: str | None,
        avatar_id: str | None,
        reference_image_url: str | None,
        image_zoom: float,
        image_x: float,
        image_y: float,
    ) -> Instructor:
        instructor = Instructor(
            id=str(uuid4()),
            display_name=display_name.strip(),
            voice_provider="elevenlabs",
            voice_id=_blank_to_none(voice_id),
            avatar_provider="heygen",
            avatar_id=_blank_to_none(avatar_id),
            reference_image_url=_blank_to_none(reference_image_url),
            image_zoom=image_zoom,
            image_x=image_x,
            image_y=image_y,
        )
        self._instructors.append(instructor)
        return instructor

    async def update(
        self,
        instructor_id: str,
        *,
        display_name: str,
        voice_id: str | None,
        avatar_id: str | None,
        reference_image_url: str | None,
        image_zoom: float,
        image_x: float,
        image_y: float,
    ) -> Instructor | None:
        for index, instructor in enumerate(self._instructors):
            if instructor.id == instructor_id:
                updated = instructor.model_copy(
                    update={
                        "display_name": display_name.strip(),
                        "voice_id": _blank_to_none(voice_id),
                        "avatar_provider": "heygen",
                        "avatar_id": _blank_to_none(avatar_id),
                        "reference_image_url": _blank_to_none(reference_image_url),
                        "image_zoom": image_zoom,
                        "image_x": image_x,
                        "image_y": image_y,
                    }
                )
                self._instructors[index] = updated
                return updated
        return None

    async def delete(self, instructor_id: str) -> bool:
        before_count = len(self._instructors)
        self._instructors = [
            instructor
            for instructor in self._instructors
            if instructor.id != instructor_id
        ]
        return len(self._instructors) != before_count


class SupabaseInstructorRepository:
    def __init__(self, settings: Settings) -> None:
        if not settings.supabase_url or not settings.supabase_service_role_key:
            raise InstructorStorageError("Supabase instructor storage is not configured")
        self._base_url = settings.supabase_url.rstrip("/")
        self._headers = {
            "apikey": settings.supabase_service_role_key,
            "Authorization": f"Bearer {settings.supabase_service_role_key}",
            "Content-Type": "application/json",
        }

    async def list(self) -> list[Instructor]:
        async with httpx.AsyncClient() as client:
            response = await client.get(
                f"{self._base_url}/rest/v1/instructors",
                headers=self._headers,
                params={
                    "select": _select_fields(),
                    "order": "display_name.asc",
                },
            )
        _raise_for_storage_error(response)
        return [Instructor.model_validate(row) for row in response.json()]

    async def get(self, instructor_id: str | None) -> Instructor | None:
        if instructor_id is None:
            instructors = await self.list()
            return instructors[0] if instructors else None
        async with httpx.AsyncClient() as client:
            response = await client.get(
                f"{self._base_url}/rest/v1/instructors",
                headers=self._headers,
                params={
                    "id": f"eq.{instructor_id}",
                    "select": _select_fields(),
                    "limit": "1",
                },
            )
        _raise_for_storage_error(response)
        rows = response.json()
        return Instructor.model_validate(rows[0]) if rows else None

    async def create(
        self,
        *,
        display_name: str,
        voice_id: str | None,
        avatar_id: str | None,
        reference_image_url: str | None,
        image_zoom: float,
        image_x: float,
        image_y: float,
    ) -> Instructor:
        payload = _payload(
            display_name=display_name,
            voice_id=voice_id,
            avatar_id=avatar_id,
            reference_image_url=reference_image_url,
            image_zoom=image_zoom,
            image_x=image_x,
            image_y=image_y,
        )
        async with httpx.AsyncClient() as client:
            response = await client.post(
                f"{self._base_url}/rest/v1/instructors",
                headers={**self._headers, "Prefer": "return=representation"},
                params={"select": _select_fields()},
                json=payload,
            )
        _raise_for_storage_error(response)
        rows = response.json()
        if not rows:
            raise InstructorStorageError("Instructor was not returned after create")
        return Instructor.model_validate(rows[0])

    async def update(
        self,
        instructor_id: str,
        *,
        display_name: str,
        voice_id: str | None,
        avatar_id: str | None,
        reference_image_url: str | None,
        image_zoom: float,
        image_x: float,
        image_y: float,
    ) -> Instructor | None:
        payload = _payload(
            display_name=display_name,
            voice_id=voice_id,
            avatar_id=avatar_id,
            reference_image_url=reference_image_url,
            image_zoom=image_zoom,
            image_x=image_x,
            image_y=image_y,
        )
        async with httpx.AsyncClient() as client:
            response = await client.patch(
                f"{self._base_url}/rest/v1/instructors",
                headers={**self._headers, "Prefer": "return=representation"},
                params={
                    "id": f"eq.{instructor_id}",
                    "select": _select_fields(),
                },
                json=payload,
            )
        _raise_for_storage_error(response)
        rows = response.json()
        return Instructor.model_validate(rows[0]) if rows else None

    async def delete(self, instructor_id: str) -> bool:
        async with httpx.AsyncClient() as client:
            response = await client.delete(
                f"{self._base_url}/rest/v1/instructors",
                headers={**self._headers, "Prefer": "return=representation"},
                params={
                    "id": f"eq.{instructor_id}",
                    "select": "id",
                },
            )
        _raise_for_storage_error(response)
        return bool(response.json())


def _payload(
    *,
    display_name: str,
    voice_id: str | None,
    avatar_id: str | None,
    reference_image_url: str | None,
    image_zoom: float,
    image_x: float,
    image_y: float,
) -> dict[str, object | None]:
    return {
        "display_name": display_name.strip(),
        "voice_provider": "elevenlabs",
        "voice_id": _blank_to_none(voice_id),
        "avatar_provider": "heygen",
        "avatar_id": _blank_to_none(avatar_id),
        "reference_image_url": _blank_to_none(reference_image_url),
        "image_zoom": image_zoom,
        "image_x": image_x,
        "image_y": image_y,
    }


def _select_fields() -> str:
    return (
        "id,display_name,voice_provider,voice_id,reference_image_url,"
        "image_zoom,image_x,image_y,avatar_provider,avatar_id"
    )


def _blank_to_none(value: str | None) -> str | None:
    if value is None:
        return None
    stripped = value.strip()
    return stripped or None


def _raise_for_storage_error(response: httpx.Response) -> None:
    if response.is_success:
        return
    raise InstructorStorageError(f"Instructor storage request failed: {response.status_code}")
