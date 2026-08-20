from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status

from app.api.dependencies.auth import get_current_user
from app.core.config import Settings, get_settings
from app.core.security import AuthenticatedUser
from app.schemas.instructor import (
    Instructor,
    InstructorCreateRequest,
    InstructorUpdateRequest,
    PublicInstructor,
)
from app.services.instructors.repository import (
    InMemoryInstructorRepository,
    InstructorStorageError,
    SupabaseInstructorRepository,
)

router = APIRouter(prefix="/instructors")

_instructors = InMemoryInstructorRepository()


@router.get("", response_model=list[Instructor])
async def list_instructors(
    _current_user: Annotated[AuthenticatedUser, Depends(get_current_user)],
    settings: Annotated[Settings, Depends(get_settings)],
) -> list[Instructor]:
    return await _instructor_repository(settings).list()


@router.get("/public", response_model=list[PublicInstructor])
async def list_public_instructors(
    settings: Annotated[Settings, Depends(get_settings)],
) -> list[PublicInstructor]:
    instructors = await _instructor_repository(settings).list()
    public_profiles = [
        _to_public_instructor(instructor)
        for instructor in instructors
        if _is_public_default(instructor)
    ]
    return public_profiles


@router.post("", response_model=Instructor, status_code=status.HTTP_201_CREATED)
async def create_instructor(
    request: InstructorCreateRequest,
    _current_user: Annotated[AuthenticatedUser, Depends(get_current_user)],
    settings: Annotated[Settings, Depends(get_settings)],
) -> Instructor:
    try:
        return await _instructor_repository(settings).create(
            display_name=request.display_name,
            voice_id=request.voice_id,
            avatar_id=request.avatar_id,
            reference_image_url=request.reference_image_url,
            image_zoom=request.image_zoom,
            image_x=request.image_x,
            image_y=request.image_y,
        )
    except InstructorStorageError as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc


@router.put("/{instructor_id}", response_model=Instructor)
async def update_instructor(
    instructor_id: str,
    request: InstructorUpdateRequest,
    _current_user: Annotated[AuthenticatedUser, Depends(get_current_user)],
    settings: Annotated[Settings, Depends(get_settings)],
) -> Instructor:
    try:
        instructor = await _instructor_repository(settings).update(
            instructor_id,
            display_name=request.display_name,
            voice_id=request.voice_id,
            avatar_id=request.avatar_id,
            reference_image_url=request.reference_image_url,
            image_zoom=request.image_zoom,
            image_x=request.image_x,
            image_y=request.image_y,
        )
    except InstructorStorageError as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc
    if instructor is None:
        raise HTTPException(status_code=404, detail="Instructor not found")
    return instructor


@router.delete("/{instructor_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_instructor(
    instructor_id: str,
    _current_user: Annotated[AuthenticatedUser, Depends(get_current_user)],
    settings: Annotated[Settings, Depends(get_settings)],
) -> None:
    try:
        deleted = await _instructor_repository(settings).delete(instructor_id)
    except InstructorStorageError as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc
    if not deleted:
        raise HTTPException(status_code=404, detail="Instructor not found")


def _instructor_repository(
    settings: Settings,
) -> InMemoryInstructorRepository | SupabaseInstructorRepository:
    if settings.app_environment == "test":
        return _instructors
    if settings.supabase_url and settings.supabase_service_role_key:
        return SupabaseInstructorRepository(settings)
    return _instructors


def _to_public_instructor(instructor: Instructor) -> PublicInstructor:
    return PublicInstructor(
        id=instructor.id,
        display_name=instructor.display_name,
        reference_image_url=instructor.reference_image_url,
        image_zoom=instructor.image_zoom,
        image_x=instructor.image_x,
        image_y=instructor.image_y,
    )


def _is_public_default(instructor: Instructor) -> bool:
    display_name = instructor.display_name.lower()
    return instructor.id in {"male", "female"} or display_name in {
        "male instructor",
        "female instructor",
    }
