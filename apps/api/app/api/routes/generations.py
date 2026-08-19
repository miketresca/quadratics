from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException

from app.api.dependencies.auth import get_current_user
from app.core.config import Settings, get_settings
from app.core.security import AuthenticatedUser
from app.providers.elevenlabs.narration_provider import ElevenLabsNarrationProvider
from app.providers.openai.animation_plan_provider import OpenAIAnimationPlanProvider
from app.providers.openai.script_provider import OpenAIScriptProvider
from app.providers.openai.speech_markup_provider import OpenAISpeechMarkupProvider
from app.schemas.equation import SolveEquationRequest
from app.schemas.generation import GenerationSnapshot, GenerationStageRunRequest
from app.services.animation.base import AnimationPlanProvider
from app.services.animation.development import DevelopmentAnimationPlanProvider
from app.services.artifacts import InMemoryArtifactRepository
from app.services.jobs.generation_jobs import InMemoryGenerationJobRepository
from app.services.narration.base import NarrationProvider
from app.services.narration.speech_markup import (
    DeterministicSpeechMarkupProvider,
    SpeechMarkupProvider,
)
from app.services.pipeline.solve_snapshot import SolveGenerationService
from app.services.rendering import DevelopmentMotionCanvasRenderer
from app.services.scripts.base import ScriptProvider
from app.services.scripts.development import DevelopmentScriptProvider
from app.services.storage.media_store import InMemoryMediaStore

router = APIRouter(prefix="/generations")

_jobs = InMemoryGenerationJobRepository()
_artifacts = InMemoryArtifactRepository()
_media_store = InMemoryMediaStore(bucket="generated-media")
_renderer = DevelopmentMotionCanvasRenderer()
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


@router.post("/{generation_id}/stages/{stage}", response_model=GenerationSnapshot)
async def run_generation_stage(
    generation_id: str,
    stage: str,
    request: GenerationStageRunRequest,
    current_user: Annotated[AuthenticatedUser, Depends(get_current_user)],
    settings: Annotated[Settings, Depends(get_settings)],
) -> GenerationSnapshot:
    if stage == "teacher_script":
        snapshot = _solve_generations.get_snapshot(
            generation_job_id=generation_id,
            user_id=current_user.id,
        )
        if snapshot is None:
            raise HTTPException(status_code=404, detail="Generation not found")
        return await _solve_generations.run_teacher_script(
            generation_job_id=generation_id,
            user_id=current_user.id,
            provider=_script_provider(settings),
            instructor_id=snapshot.job.instructor_id,
            output_mode="audio",
            word_budget=settings.script_word_budget,
            force=request.force,
        )
    if stage == "elevenlabs_audio":
        snapshot = _solve_generations.get_snapshot(
            generation_job_id=generation_id,
            user_id=current_user.id,
        )
        if snapshot is None:
            raise HTTPException(status_code=404, detail="Generation not found")
        return await _solve_generations.run_narration(
            generation_job_id=generation_id,
            user_id=current_user.id,
            provider=_narration_provider(settings),
            speech_markup_provider=_speech_markup_provider(settings),
            media_store=_media_store,
            instructor_id=snapshot.job.instructor_id,
            voice_id=_voice_id_for_instructor(settings, snapshot.job.instructor_id),
            model_id=settings.elevenlabs_model_id,
            force=request.force,
            script_segment_id=request.script_segment_id,
        )
    if stage == "animation_plan":
        snapshot = _solve_generations.get_snapshot(
            generation_job_id=generation_id,
            user_id=current_user.id,
        )
        if snapshot is None:
            raise HTTPException(status_code=404, detail="Generation not found")
        return await _solve_generations.run_animation_plan(
            generation_job_id=generation_id,
            user_id=current_user.id,
            provider=_animation_plan_provider(settings),
            force=request.force,
        )
    if stage == "resolved_timeline":
        return _solve_generations.run_resolved_timeline(
            generation_job_id=generation_id,
            user_id=current_user.id,
            force=request.force,
        )
    if stage == "motion_canvas_render":
        return _solve_generations.run_render(
            generation_job_id=generation_id,
            user_id=current_user.id,
            renderer=_renderer,
            media_store=_media_store,
            force=request.force,
        )
    raise HTTPException(status_code=400, detail=f"Unsupported generation stage '{stage}'")


@router.post("/{generation_id}/run-all", response_model=GenerationSnapshot)
async def run_all_generation_stages(
    generation_id: str,
    request: GenerationStageRunRequest,
    current_user: Annotated[AuthenticatedUser, Depends(get_current_user)],
    settings: Annotated[Settings, Depends(get_settings)],
) -> GenerationSnapshot:
    snapshot = _solve_generations.get_snapshot(
        generation_job_id=generation_id,
        user_id=current_user.id,
    )
    if snapshot is None:
        raise HTTPException(status_code=404, detail="Generation not found")
    await _solve_generations.run_teacher_script(
        generation_job_id=generation_id,
        user_id=current_user.id,
        provider=_script_provider(settings),
        instructor_id=snapshot.job.instructor_id,
        output_mode="audio",
        word_budget=settings.script_word_budget,
        force=request.force,
    )
    await _solve_generations.run_narration(
        generation_job_id=generation_id,
        user_id=current_user.id,
        provider=_narration_provider(settings),
        speech_markup_provider=_speech_markup_provider(settings),
        media_store=_media_store,
        instructor_id=snapshot.job.instructor_id,
        voice_id=_voice_id_for_instructor(settings, snapshot.job.instructor_id),
        model_id=settings.elevenlabs_model_id,
        force=request.force,
        script_segment_id=request.script_segment_id,
    )
    await _solve_generations.run_animation_plan(
        generation_job_id=generation_id,
        user_id=current_user.id,
        provider=_animation_plan_provider(settings),
        force=request.force,
    )
    _solve_generations.run_resolved_timeline(
        generation_job_id=generation_id,
        user_id=current_user.id,
        force=request.force,
    )
    return _solve_generations.run_render(
        generation_job_id=generation_id,
        user_id=current_user.id,
        renderer=_renderer,
        media_store=_media_store,
        force=request.force,
    )


def _script_provider(settings: Settings) -> ScriptProvider:
    if not settings.script_generation_enabled:
        return DevelopmentScriptProvider()
    return OpenAIScriptProvider(
        api_key=settings.openai_api_key,
        model=settings.openai_script_model,
    )


def _animation_plan_provider(settings: Settings) -> AnimationPlanProvider:
    if not settings.script_generation_enabled:
        return DevelopmentAnimationPlanProvider()
    return OpenAIAnimationPlanProvider(
        api_key=settings.openai_api_key,
        model=settings.openai_script_model,
    )


def _narration_provider(settings: Settings) -> NarrationProvider:
    return ElevenLabsNarrationProvider(
        api_key=settings.elevenlabs_api_key,
        model_id=settings.elevenlabs_model_id,
    )


def _speech_markup_provider(settings: Settings) -> SpeechMarkupProvider:
    if not settings.script_generation_enabled:
        return DeterministicSpeechMarkupProvider()
    return OpenAISpeechMarkupProvider(
        api_key=settings.openai_api_key,
        model=settings.openai_script_model,
    )


def _voice_id_for_instructor(settings: Settings, instructor_id: str | None) -> str:
    if instructor_id == "female":
        return settings.elevenlabs_female_voice_id
    return settings.elevenlabs_male_voice_id
