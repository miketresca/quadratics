from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status

from app.api.dependencies.auth import get_current_user
from app.core.config import Settings, get_settings
from app.core.security import AuthenticatedUser
from app.schemas.instructor import Instructor, InstructorCreateRequest, InstructorUpdateRequest
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
