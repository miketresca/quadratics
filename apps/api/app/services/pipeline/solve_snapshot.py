from __future__ import annotations

from dataclasses import asdict

from fastapi import HTTPException

from app.schemas.artifact import GenerationArtifact, GenerationArtifactDependency
from app.schemas.generation import GenerationJob, GenerationSnapshot
from app.schemas.lesson import LessonResponse
from app.services.artifacts import ArtifactLifecycleService, InMemoryArtifactRepository
from app.services.artifacts.repository import ArtifactDependencyRecord, ArtifactRecord
from app.services.jobs.generation_jobs import (
    GenerationJobRecord,
    InMemoryGenerationJobRepository,
)
from app.services.lessons.builder import build_lesson
from app.services.math.parser import EquationParseError, parse_equation
from app.services.math.solver import solve_quadratic
from app.services.math.validator import QuadraticValidationError, validate_quadratic

SOLVER_VERSION = "sympy-quadratic-v1"
LESSON_BUILDER_VERSION = "factoring-lesson-v1"


class SolveGenerationService:
    def __init__(
        self,
        *,
        jobs: InMemoryGenerationJobRepository,
        artifacts: InMemoryArtifactRepository,
    ) -> None:
        self._jobs = jobs
        self._artifacts = artifacts
        self._lifecycle = ArtifactLifecycleService(artifacts)

    def create_generation(
        self,
        *,
        user_id: str,
        equation: str,
        instructor_id: str | None = None,
    ) -> GenerationSnapshot:
        lesson = lesson_from_equation(equation)
        job = self._jobs.create_solve_job(
            user_id=user_id,
            equation_input=equation,
            normalized_equation=lesson.normalized_equation,
            equation_hash=None,
            instructor_id=instructor_id,
        )
        solution_run = self._lifecycle.start_stage(
            generation_job_id=job.id,
            user_id=user_id,
            stage="solution",
            input_payload={
                "equationInput": equation,
                "normalizedEquation": lesson.normalized_equation,
                "solverVersion": SOLVER_VERSION,
            },
        )
        solution = self._artifacts.complete_attempt(
            solution_run.artifact.id,
            payload={
                "originalEquation": lesson.original_equation,
                "normalizedEquation": lesson.normalized_equation,
                "coefficients": lesson.coefficients.model_dump(by_alias=True),
                "solutions": [solution.model_dump(by_alias=True) for solution in lesson.solutions],
            },
        )
        lesson_run = self._lifecycle.start_stage(
            generation_job_id=job.id,
            user_id=user_id,
            stage="lesson",
            input_payload={
                "solutionArtifactId": solution.id,
                "lessonBuilderVersion": LESSON_BUILDER_VERSION,
            },
            upstream_artifact_ids=[solution.id],
        )
        self._artifacts.complete_attempt(
            lesson_run.artifact.id,
            payload=lesson.model_dump(by_alias=True),
        )
        return self.snapshot_for_job(job=job, lesson=lesson)

    def get_snapshot(self, *, generation_job_id: str, user_id: str) -> GenerationSnapshot | None:
        job = self._jobs.get_for_user(generation_job_id=generation_job_id, user_id=user_id)
        if job is None:
            return None
        lesson_artifact = next(
            (
                artifact
                for artifact in self._artifacts.list_for_generation(job.id)
                if artifact.stage == "lesson" and artifact.is_current
            ),
            None,
        )
        if lesson_artifact is None:
            return None
        lesson = LessonResponse.model_validate(lesson_artifact.payload)
        return self.snapshot_for_job(job=job, lesson=lesson)

    def snapshot_for_job(
        self,
        *,
        job: GenerationJobRecord,
        lesson: LessonResponse,
    ) -> GenerationSnapshot:
        return GenerationSnapshot(
            job=_job_schema(job),
            lesson=lesson,
            artifacts=[
                _artifact_schema(artifact)
                for artifact in self._artifacts.list_for_generation(job.id)
            ],
            dependencies=[
                _dependency_schema(dependency)
                for dependency in self._artifacts.dependencies_for_generation(job.id)
            ],
        )


def lesson_from_equation(equation: str) -> LessonResponse:
    try:
        parsed = parse_equation(equation)
        quadratic = validate_quadratic(parsed)
        solution = solve_quadratic(quadratic)
    except (EquationParseError, QuadraticValidationError) as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
    return build_lesson(solution)


def _job_schema(job: GenerationJobRecord) -> GenerationJob:
    return GenerationJob(**asdict(job))


def _artifact_schema(artifact: ArtifactRecord) -> GenerationArtifact:
    return GenerationArtifact(
        id=artifact.id,
        generation_job_id=artifact.generation_job_id,
        user_id=artifact.user_id,
        stage=artifact.stage,
        version=artifact.version,
        status=artifact.status,
        input_hash=artifact.input_hash,
        upstream_artifact_ids=artifact.upstream_artifact_ids,
        provider=artifact.provider,
        model=artifact.model,
        config_metadata=artifact.config_metadata,
        payload=artifact.payload,
        storage_objects=[storage_reference for storage_reference in artifact.storage_objects],
        is_current=artifact.is_current,
        cache_hit=artifact.cache_hit,
        stale_reason=artifact.stale_reason,
        error_code=artifact.error_code,
        error_message=artifact.error_message,
        created_at=artifact.created_at,
        completed_at=artifact.completed_at,
    )


def _dependency_schema(dependency: ArtifactDependencyRecord) -> GenerationArtifactDependency:
    return GenerationArtifactDependency(
        generation_job_id=dependency.generation_job_id,
        upstream_artifact_id=dependency.upstream_artifact_id,
        downstream_artifact_id=dependency.downstream_artifact_id,
        dependency_hash=dependency.dependency_hash,
        metadata=dependency.metadata,
        created_at=dependency.created_at,
    )
