from __future__ import annotations

from dataclasses import asdict

from fastapi import HTTPException

from app.schemas.animation import AnimationPlan
from app.schemas.artifact import (
    ArtifactStorageObject,
    GenerationArtifact,
    GenerationArtifactDependency,
)
from app.schemas.generation import GenerationJob, GenerationSnapshot
from app.schemas.lesson import LessonResponse
from app.schemas.narration import LessonNarration
from app.schemas.script import LessonScript, OutputMode
from app.services.animation.base import AnimationPlanProvider
from app.services.animation.builder import build_animation_plan
from app.services.animation.resolver import TimelineResolutionError, resolve_animation_timeline
from app.services.artifacts import ArtifactLifecycleService, InMemoryArtifactRepository
from app.services.artifacts.repository import (
    ArtifactDependencyRecord,
    ArtifactRecord,
    ArtifactStorageReference,
)
from app.services.avatars.base import AvatarVideoProvider, AvatarVideoRequest
from app.services.jobs.generation_jobs import (
    GenerationJobRecord,
    InMemoryGenerationJobRepository,
)
from app.services.lessons.builder import build_lesson
from app.services.math.parser import EquationParseError, parse_equation
from app.services.math.solver import solve_quadratic
from app.services.math.validator import QuadraticValidationError, validate_quadratic
from app.services.narration.artifacts import NarrationArtifactService
from app.services.narration.base import NarrationProvider
from app.services.narration.builder import build_lesson_narration
from app.services.narration.speech_markup import SpeechMarkupProvider
from app.services.rendering.base import MotionCanvasRenderer, RenderRequest
from app.services.scripts.base import ScriptProvider
from app.services.scripts.builder import build_lesson_script
from app.services.storage.media_store import MediaStore
from app.services.usage.costs import UsageCostRepository

SOLVER_VERSION = "sympy-quadratic-v1"
LESSON_BUILDER_VERSION = "factoring-lesson-v1"
GOLDEN_DEVELOPMENT_CHECKPOINT_EQUATION = "x**2 + 5*x + 6 = 0"


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
        reuse_development_checkpoint: bool = False,
    ) -> GenerationSnapshot:
        lesson = lesson_from_equation(equation)
        if (
            reuse_development_checkpoint
            and lesson.normalized_equation == GOLDEN_DEVELOPMENT_CHECKPOINT_EQUATION
        ):
            existing_job = self._jobs.latest_for_user_equation(
                user_id=user_id,
                normalized_equation=lesson.normalized_equation,
                instructor_id=instructor_id,
            )
            if existing_job is not None:
                existing_snapshot = self.get_snapshot(
                    generation_job_id=existing_job.id,
                    user_id=user_id,
                )
                if existing_snapshot is not None:
                    return existing_snapshot
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

    async def run_teacher_script(
        self,
        *,
        generation_job_id: str,
        user_id: str,
        provider: ScriptProvider,
        instructor_id: str | None,
        output_mode: OutputMode,
        word_budget: int,
        usage_costs: UsageCostRepository | None = None,
        input_token_cost_per_million_usd: float = 0,
        output_token_cost_per_million_usd: float = 0,
        force: bool = False,
    ) -> GenerationSnapshot:
        job, lesson, lesson_artifact = self._current_lesson_context(
            generation_job_id=generation_job_id,
            user_id=user_id,
        )
        stage_run = self._lifecycle.start_stage(
            generation_job_id=generation_job_id,
            user_id=user_id,
            stage="teacher_script",
            input_payload={
                "lessonArtifactId": lesson_artifact.id,
                "instructorId": instructor_id,
                "outputMode": output_mode,
                "wordBudget": word_budget,
            },
            upstream_artifact_ids=[lesson_artifact.id],
            provider=provider.__class__.__name__,
            model=getattr(provider, "model", None),
            force=force,
        )
        if stage_run.cache_hit:
            return self.snapshot_for_job(job=job, lesson=lesson)
        script = await build_lesson_script(
            lesson=lesson,
            provider=provider,
            instructor_id=instructor_id,
            output_mode=output_mode,
            word_budget=word_budget,
        )
        self._artifacts.complete_attempt(
            stage_run.artifact.id,
            payload=script.model_dump(mode="json", by_alias=True),
        )
        await _record_openai_token_usage(
            usage_costs=usage_costs,
            user_id=user_id,
            generation_job_id=generation_job_id,
            stage="teacher_script",
            model=getattr(provider, "model", None),
            provider_metadata=script.provider_metadata,
            input_token_cost_per_million_usd=input_token_cost_per_million_usd,
            output_token_cost_per_million_usd=output_token_cost_per_million_usd,
        )
        return self.snapshot_for_job(job=job, lesson=lesson)

    async def run_narration(
        self,
        *,
        generation_job_id: str,
        user_id: str,
        provider: NarrationProvider,
        speech_markup_provider: SpeechMarkupProvider,
        media_store: MediaStore,
        instructor_id: str | None,
        voice_id: str | None,
        model_id: str,
        usage_costs: UsageCostRepository | None = None,
        elevenlabs_cost_per_credit_usd: float = 0,
        force: bool = False,
        script_segment_id: str | None = None,
    ) -> GenerationSnapshot:
        job, lesson, _lesson_artifact = self._current_lesson_context(
            generation_job_id=generation_job_id,
            user_id=user_id,
        )
        script_artifact = self._artifacts.current_for_stage(
            generation_job_id=generation_job_id,
            stage="teacher_script",
        )
        if script_artifact is None:
            raise HTTPException(status_code=409, detail="Teacher script artifact is required")
        script = LessonScript.model_validate(script_artifact.payload)
        if not script.segments:
            raise HTTPException(status_code=409, detail="Completed teacher script is required")

        narration_service = NarrationArtifactService(
            repository=self._artifacts,
            media_store=media_store,
        )
        reusable = None
        request_artifact = self._artifacts.current_for_stage(
            generation_job_id=generation_job_id,
            stage="elevenlabs_request",
        )
        if request_artifact and not force and request_artifact.payload.get("speechText"):
            reusable = narration_service.find_reusable_narration(
                generation_job_id=generation_job_id,
                script_artifact_id=script_artifact.id,
                speech_text=str(request_artifact.payload["speechText"]),
                voice_id=voice_id or "",
                model_id=model_id,
                voice_settings={},
            )
        if reusable is not None:
            return self.snapshot_for_job(job=job, lesson=lesson)

        narration = await build_lesson_narration(
            script=script,
            provider=provider,
            instructor_id=instructor_id,
            output_mode="audio",
            voice_id=voice_id,
            model_id=model_id,
            speech_markup_provider=speech_markup_provider,
            script_segment_id=script_segment_id,
        )
        if narration.status != "completed":
            failed_run = self._lifecycle.start_stage(
                generation_job_id=generation_job_id,
                user_id=user_id,
                stage="elevenlabs_audio",
                input_payload={
                    "scriptArtifactId": script_artifact.id,
                    "status": narration.status,
                    "reason": narration.unsupported_reason,
                },
                upstream_artifact_ids=[script_artifact.id],
                provider="elevenlabs",
                model=model_id,
                force=True,
            )
            self._artifacts.fail_attempt(
                failed_run.artifact.id,
                error_code=narration.status,
                error_message=narration.unsupported_reason or "Narration failed",
            )
            return self.snapshot_for_job(job=job, lesson=lesson)
        narration_service.persist_completed_narration(
            generation_job_id=generation_job_id,
            user_id=user_id,
            script_artifact_id=script_artifact.id,
            narration=narration,
            voice_id=voice_id or "",
            model_id=model_id,
            voice_settings={},
            force=force,
        )
        await _record_elevenlabs_usage(
            usage_costs=usage_costs,
            user_id=user_id,
            generation_job_id=generation_job_id,
            model_id=model_id,
            narration=narration,
            cost_per_credit_usd=elevenlabs_cost_per_credit_usd,
        )
        return self.snapshot_for_job(job=job, lesson=lesson)

    async def run_animation_plan(
        self,
        *,
        generation_job_id: str,
        user_id: str,
        provider: AnimationPlanProvider,
        usage_costs: UsageCostRepository | None = None,
        input_token_cost_per_million_usd: float = 0,
        output_token_cost_per_million_usd: float = 0,
        force: bool = False,
    ) -> GenerationSnapshot:
        job, lesson, lesson_artifact = self._current_lesson_context(
            generation_job_id=generation_job_id,
            user_id=user_id,
        )
        script_artifact = self._current_required(generation_job_id, "teacher_script")
        narration_artifact = self._current_required(generation_job_id, "elevenlabs_audio")
        script = LessonScript.model_validate(script_artifact.payload)
        narration = LessonNarration.model_validate(narration_artifact.payload)
        stage_run = self._lifecycle.start_stage(
            generation_job_id=generation_job_id,
            user_id=user_id,
            stage="animation_plan",
            input_payload={
                "lessonArtifactId": lesson_artifact.id,
                "scriptArtifactId": script_artifact.id,
                "narrationArtifactId": narration_artifact.id,
            },
            upstream_artifact_ids=[lesson_artifact.id, script_artifact.id, narration_artifact.id],
            provider=provider.__class__.__name__,
            model=getattr(provider, "model", None),
            force=force,
        )
        if stage_run.cache_hit:
            return self.snapshot_for_job(job=job, lesson=lesson)
        try:
            plan = await build_animation_plan(
                lesson=lesson,
                script=script,
                narration=narration,
                lesson_artifact_id=lesson_artifact.id,
                narration_artifact_id=narration_artifact.id,
                provider=provider,
            )
        except Exception as exc:
            self._artifacts.fail_attempt(
                stage_run.artifact.id,
                error_code="animation_plan_failed",
                error_message=str(exc),
            )
            return self.snapshot_for_job(job=job, lesson=lesson)
        self._artifacts.complete_attempt(
            stage_run.artifact.id,
            payload=plan.model_dump(mode="json", by_alias=True),
        )
        await _record_openai_token_usage(
            usage_costs=usage_costs,
            user_id=user_id,
            generation_job_id=generation_job_id,
            stage="animation_plan",
            model=getattr(provider, "model", None),
            provider_metadata=plan.metadata,
            input_token_cost_per_million_usd=input_token_cost_per_million_usd,
            output_token_cost_per_million_usd=output_token_cost_per_million_usd,
        )
        return self.snapshot_for_job(job=job, lesson=lesson)

    def run_resolved_timeline(
        self,
        *,
        generation_job_id: str,
        user_id: str,
        force: bool = False,
    ) -> GenerationSnapshot:
        job, lesson, _lesson_artifact = self._current_lesson_context(
            generation_job_id=generation_job_id,
            user_id=user_id,
        )
        plan_artifact = self._current_required(generation_job_id, "animation_plan")
        narration_artifact = self._current_required(generation_job_id, "elevenlabs_audio")
        plan = AnimationPlan.model_validate(plan_artifact.payload)
        narration = LessonNarration.model_validate(narration_artifact.payload)
        stage_run = self._lifecycle.start_stage(
            generation_job_id=generation_job_id,
            user_id=user_id,
            stage="resolved_timeline",
            input_payload={
                "animationPlanArtifactId": plan_artifact.id,
                "narrationArtifactId": narration_artifact.id,
            },
            upstream_artifact_ids=[plan_artifact.id, narration_artifact.id],
            force=force,
        )
        if stage_run.cache_hit:
            return self.snapshot_for_job(job=job, lesson=lesson)
        try:
            timeline = resolve_animation_timeline(plan, narration=narration)
        except TimelineResolutionError as exc:
            self._artifacts.fail_attempt(
                stage_run.artifact.id,
                error_code="timeline_resolution_failed",
                error_message=str(exc),
            )
            return self.snapshot_for_job(job=job, lesson=lesson)
        self._artifacts.complete_attempt(
            stage_run.artifact.id,
            payload=timeline.model_dump(mode="json", by_alias=True),
        )
        return self.snapshot_for_job(job=job, lesson=lesson)

    async def run_heygen_avatar(
        self,
        *,
        generation_job_id: str,
        user_id: str,
        avatar_id: str,
        provider: AvatarVideoProvider,
        media_store: MediaStore,
        usage_costs: UsageCostRepository | None = None,
        output_format: str = "webm",
        cost_per_second_usd: float = 0,
        force: bool = False,
    ) -> GenerationSnapshot:
        job, lesson, _lesson_artifact = self._current_lesson_context(
            generation_job_id=generation_job_id,
            user_id=user_id,
        )
        narration_artifact = self._current_required(generation_job_id, "elevenlabs_audio")
        audio_url = _narration_audio_url_for_avatar(narration_artifact, provider=provider)
        stage_run = self._lifecycle.start_stage(
            generation_job_id=generation_job_id,
            user_id=user_id,
            stage="heygen_avatar",
            input_payload={
                "narrationArtifactId": narration_artifact.id,
                "avatarId": avatar_id,
                "outputFormat": output_format,
            },
            upstream_artifact_ids=[narration_artifact.id],
            provider="heygen",
            model="avatar_iv",
            config_metadata={
                "avatarId": avatar_id,
                "outputFormat": output_format,
            },
            force=force,
        )
        if stage_run.cache_hit:
            return self.snapshot_for_job(job=job, lesson=lesson)
        try:
            result = await provider.generate(
                AvatarVideoRequest(
                    generation_job_id=generation_job_id,
                    avatar_id=avatar_id,
                    audio_url=audio_url,
                    title=f"Quadratics {generation_job_id}",
                    output_format=output_format,
                )
            )
            extension = "webm" if result.output_format == "webm" else "mp4"
            avatar_ref = media_store.put(
                path=f"{user_id}/{generation_job_id}/avatars/{stage_run.artifact.id}.{extension}",
                content=result.content,
                content_type=result.content_type,
                metadata={
                    "providerVideoId": result.provider_video_id,
                    "outputFormat": result.output_format,
                },
            )
        except Exception as exc:
            self._artifacts.fail_attempt(
                stage_run.artifact.id,
                error_code="heygen_avatar_failed",
                error_message=str(exc),
            )
            return self.snapshot_for_job(job=job, lesson=lesson)
        self._artifacts.complete_attempt(
            stage_run.artifact.id,
            payload={
                "providerVideoId": result.provider_video_id,
                "durationSeconds": result.duration_seconds,
                "outputFormat": result.output_format,
                "metadata": result.provider_metadata,
            },
            storage_objects=[
                ArtifactStorageObject(
                    bucket=avatar_ref.bucket,
                    path=avatar_ref.path,
                    signed_url=avatar_ref.signed_url,
                    content_type=avatar_ref.content_type,
                    size_bytes=avatar_ref.size_bytes,
                    checksum_sha256=avatar_ref.checksum_sha256,
                    duration_seconds=result.duration_seconds,
                    metadata=avatar_ref.metadata,
                )
            ],
        )
        await _record_heygen_usage(
            usage_costs=usage_costs,
            user_id=user_id,
            generation_job_id=generation_job_id,
            duration_seconds=result.duration_seconds,
            cost_per_second_usd=cost_per_second_usd,
        )
        return self.snapshot_for_job(job=job, lesson=lesson)

    def run_render(
        self,
        *,
        generation_job_id: str,
        user_id: str,
        renderer: MotionCanvasRenderer,
        media_store: MediaStore,
        force: bool = False,
    ) -> GenerationSnapshot:
        job, lesson, _lesson_artifact = self._current_lesson_context(
            generation_job_id=generation_job_id,
            user_id=user_id,
        )
        timeline_artifact = self._current_required(generation_job_id, "resolved_timeline")
        narration_artifact = self._current_required(generation_job_id, "elevenlabs_audio")
        avatar_artifact = self._artifacts.current_for_stage(
            generation_job_id=generation_job_id,
            stage="heygen_avatar",
        )
        avatar_storage_objects = [
            _storage_reference_payload(storage_reference)
            for storage_reference in (avatar_artifact.storage_objects if avatar_artifact else [])
        ]
        upstream_artifact_ids = [timeline_artifact.id, narration_artifact.id]
        input_payload: dict[str, object] = {
            "timelineArtifactId": timeline_artifact.id,
            "narrationArtifactId": narration_artifact.id,
            "rendererVersion": renderer.__class__.__name__,
        }
        if avatar_artifact is not None and avatar_artifact.status == "completed":
            upstream_artifact_ids.append(avatar_artifact.id)
            input_payload["avatarArtifactId"] = avatar_artifact.id
        stage_run = self._lifecycle.start_stage(
            generation_job_id=generation_job_id,
            user_id=user_id,
            stage="motion_canvas_render",
            input_payload=input_payload,
            upstream_artifact_ids=upstream_artifact_ids,
            provider="motion_canvas",
            model=renderer.__class__.__name__,
            force=force,
        )
        if stage_run.cache_hit:
            return self.snapshot_for_job(job=job, lesson=lesson)
        duration_seconds = float(timeline_artifact.payload.get("durationSeconds") or 0)
        render_input: dict[str, object] = {
            "lesson": lesson.model_dump(mode="json", by_alias=True),
            "timeline": timeline_artifact.payload,
            "narration": narration_artifact.payload,
            "narrationStorageObjects": [
                _storage_reference_payload(storage_reference)
                for storage_reference in narration_artifact.storage_objects
            ],
        }
        if avatar_artifact is not None and avatar_artifact.status == "completed":
            render_input["avatar"] = avatar_artifact.payload
            render_input["avatarStorageObjects"] = avatar_storage_objects
        try:
            result = renderer.render(
                RenderRequest(
                    generation_job_id=generation_job_id,
                    timeline_artifact_id=timeline_artifact.id,
                    duration_seconds=duration_seconds,
                    render_input=render_input,
                )
            )
            video_ref = media_store.put(
                path=f"{user_id}/{generation_job_id}/renders/{stage_run.artifact.id}.mp4",
                content=result.content,
                content_type=result.content_type,
                metadata={"timelineArtifactId": timeline_artifact.id},
            )
        except Exception as exc:
            self._artifacts.fail_attempt(
                stage_run.artifact.id,
                error_code="motion_canvas_render_failed",
                error_message=str(exc),
            )
            return self.snapshot_for_job(job=job, lesson=lesson)
        render_artifact = self._artifacts.complete_attempt(
            stage_run.artifact.id,
            payload={
                "durationSeconds": result.duration_seconds,
                "rendererVersion": result.renderer_version,
                **(
                    {"avatarArtifactId": avatar_artifact.id}
                    if avatar_artifact is not None and avatar_artifact.status == "completed"
                    else {}
                ),
            },
            storage_objects=[
                ArtifactStorageObject(
                    bucket=video_ref.bucket,
                    path=video_ref.path,
                    signed_url=video_ref.signed_url,
                    content_type=video_ref.content_type,
                    size_bytes=video_ref.size_bytes,
                    checksum_sha256=video_ref.checksum_sha256,
                    duration_seconds=result.duration_seconds,
                    metadata=video_ref.metadata,
                )
            ],
        )
        base_video_run = self._lifecycle.start_stage(
            generation_job_id=generation_job_id,
            user_id=user_id,
            stage="base_video",
            input_payload={"renderArtifactId": render_artifact.id},
            upstream_artifact_ids=[render_artifact.id],
            force=force,
        )
        if not base_video_run.cache_hit:
            self._artifacts.complete_attempt(
                base_video_run.artifact.id,
                payload={
                    "renderArtifactId": render_artifact.id,
                    "durationSeconds": result.duration_seconds,
                },
                storage_objects=render_artifact.storage_objects,
            )
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

    def _current_lesson_context(
        self,
        *,
        generation_job_id: str,
        user_id: str,
    ) -> tuple[GenerationJobRecord, LessonResponse, ArtifactRecord]:
        job = self._jobs.get_for_user(generation_job_id=generation_job_id, user_id=user_id)
        if job is None:
            raise HTTPException(status_code=404, detail="Generation not found")
        lesson_artifact = self._artifacts.current_for_stage(
            generation_job_id=generation_job_id,
            stage="lesson",
        )
        if lesson_artifact is None:
            raise HTTPException(status_code=409, detail="Lesson artifact is required")
        lesson = LessonResponse.model_validate(lesson_artifact.payload)
        return job, lesson, lesson_artifact

    def _current_required(self, generation_job_id: str, stage: str) -> ArtifactRecord:
        artifact = self._artifacts.current_for_stage(
            generation_job_id=generation_job_id,
            stage=stage,  # type: ignore[arg-type]
        )
        if artifact is None:
            raise HTTPException(status_code=409, detail=f"{stage} artifact is required")
        return artifact


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
        storage_objects=[
            ArtifactStorageObject(
                bucket=storage_reference.bucket,
                path=storage_reference.path,
                signed_url=storage_reference.signed_url,
                content_type=storage_reference.content_type,
                size_bytes=storage_reference.size_bytes,
                checksum_sha256=storage_reference.checksum_sha256,
                duration_seconds=storage_reference.duration_seconds,
                metadata=storage_reference.metadata,
            )
            for storage_reference in artifact.storage_objects
        ],
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


def _storage_reference_payload(
    storage_reference: ArtifactStorageReference,
) -> dict[str, object | None]:
    return {
        "bucket": storage_reference.bucket,
        "path": storage_reference.path,
        "signedUrl": storage_reference.signed_url,
        "contentType": storage_reference.content_type,
        "sizeBytes": storage_reference.size_bytes,
        "checksumSha256": storage_reference.checksum_sha256,
        "durationSeconds": storage_reference.duration_seconds,
        "metadata": storage_reference.metadata,
    }


async def _record_openai_token_usage(
    *,
    usage_costs: UsageCostRepository | None,
    user_id: str,
    generation_job_id: str,
    stage: str,
    model: str | None,
    provider_metadata: dict[str, object],
    input_token_cost_per_million_usd: float,
    output_token_cost_per_million_usd: float,
) -> None:
    if usage_costs is None or model is None:
        return
    input_tokens = _numeric_metadata(provider_metadata, "inputTokens")
    output_tokens = _numeric_metadata(provider_metadata, "outputTokens")
    if input_tokens is not None:
        await usage_costs.record(
            user_id=user_id,
            generation_job_id=generation_job_id,
            stage=stage,
            provider="openai",
            model=model,
            unit_type="input_tokens",
            quantity=input_tokens,
            unit_cost_usd=input_token_cost_per_million_usd / 1_000_000,
            metadata={"source": "openai_usage"},
        )
    if output_tokens is not None:
        await usage_costs.record(
            user_id=user_id,
            generation_job_id=generation_job_id,
            stage=stage,
            provider="openai",
            model=model,
            unit_type="output_tokens",
            quantity=output_tokens,
            unit_cost_usd=output_token_cost_per_million_usd / 1_000_000,
            metadata={"source": "openai_usage"},
        )


async def _record_elevenlabs_usage(
    *,
    usage_costs: UsageCostRepository | None,
    user_id: str,
    generation_job_id: str,
    model_id: str,
    narration: LessonNarration,
    cost_per_credit_usd: float,
) -> None:
    if usage_costs is None or narration.speech_text is None:
        return
    credits = len(narration.speech_text)
    await usage_costs.record(
        user_id=user_id,
        generation_job_id=generation_job_id,
        stage="elevenlabs_audio",
        provider="elevenlabs",
        model=model_id,
        unit_type="credits",
        quantity=credits,
        unit_cost_usd=cost_per_credit_usd,
        metadata={
            "source": "speech_text_character_count",
            "durationSeconds": narration.duration_seconds or 0,
        },
    )


async def _record_heygen_usage(
    *,
    usage_costs: UsageCostRepository | None,
    user_id: str,
    generation_job_id: str,
    duration_seconds: float,
    cost_per_second_usd: float,
) -> None:
    if usage_costs is None:
        return
    await usage_costs.record(
        user_id=user_id,
        generation_job_id=generation_job_id,
        stage="heygen_avatar",
        provider="heygen",
        model="avatar_iv",
        unit_type="seconds",
        quantity=max(duration_seconds, 0),
        unit_cost_usd=cost_per_second_usd,
        metadata={"source": "avatar_video_duration"},
    )


def _narration_audio_url_for_avatar(
    narration_artifact: ArtifactRecord,
    *,
    provider: AvatarVideoProvider,
) -> str:
    if provider.__class__.__name__ == "DevelopmentAvatarVideoProvider":
        return "development://narration-audio"
    signed_urls = [
        storage_reference.signed_url
        for storage_reference in narration_artifact.storage_objects
        if storage_reference.signed_url
    ]
    if len(signed_urls) != 1:
        raise ValueError(
            "HeyGen avatar generation requires one combined narration audio URL. "
            "The current narration artifact contains segmented audio."
        )
    return signed_urls[0]


def _numeric_metadata(metadata: dict[str, object], key: str) -> float | None:
    value = metadata.get(key)
    if isinstance(value, int | float):
        return float(value)
    return None
