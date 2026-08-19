from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException

from app.api.dependencies.auth import get_current_user
from app.core.security import AuthenticatedUser
from app.schemas.equation import SolveEquationRequest
from app.schemas.generation import GenerationSnapshot
from app.services.artifacts import InMemoryArtifactRepository
from app.services.jobs.generation_jobs import InMemoryGenerationJobRepository
from app.services.pipeline.solve_snapshot import SolveGenerationService

router = APIRouter(prefix="/generations")

_jobs = InMemoryGenerationJobRepository()
_artifacts = InMemoryArtifactRepository()
_solve_generations = SolveGenerationService(jobs=_jobs, artifacts=_artifacts)


@router.post("", response_model=GenerationSnapshot)
async def create_generation(
    request: SolveEquationRequest,
    current_user: Annotated[AuthenticatedUser, Depends(get_current_user)],
) -> GenerationSnapshot:
    return _solve_generations.create_generation(
        user_id=current_user.id,
        equation=request.equation,
        instructor_id=request.instructor_id,
    )


@router.get("/{generation_id}", response_model=GenerationSnapshot)
async def get_generation(
    generation_id: str,
    current_user: Annotated[AuthenticatedUser, Depends(get_current_user)],
) -> GenerationSnapshot:
    snapshot = _solve_generations.get_snapshot(
        generation_job_id=generation_id,
        user_id=current_user.id,
    )
    if snapshot is None:
        raise HTTPException(status_code=404, detail="Generation not found")
    return snapshot
