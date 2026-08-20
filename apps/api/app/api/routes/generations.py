from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException

from app.api.dependencies.auth import get_current_user
from app.api.routes.instructors import _instructor_repository
from app.api.routes.usage_costs import _usage_repository
from app.core.config import Settings, get_settings
from app.core.security import AuthenticatedUser
from app.providers.elevenlabs.narration_provider import ElevenLabsNarrationProvider
from app.providers.heygen.avatar_provider import HeyGenAvatarVideoProvider
from app.providers.openai.animation_plan_provider import OpenAIAnimationPlanProvider
from app.providers.openai.real_world_context_provider import OpenAIRealWorldContextProvider
from app.providers.openai.script_provider import OpenAIScriptProvider
from app.providers.openai.speech_markup_provider import OpenAISpeechMarkupProvider
from app.schemas.equation import SolveEquationRequest
from app.schemas.generation import (
    GenerationSnapshot,
    GenerationStageRunRequest,
    LatestGenerationVideo,
    LatestGenerationVideos,
    PublicLatestRenderVideos,
)
from app.services.animation.base import AnimationPlanProvider
from app.services.animation.development import DevelopmentAnimationPlanProvider
from app.services.artifacts import InMemoryArtifactRepository, SupabaseArtifactRepository
from app.services.avatars import AvatarVideoProvider, DevelopmentAvatarVideoProvider
from app.services.context.base import RealWorldContextProvider
from app.services.context.development import DevelopmentRealWorldContextProvider
from app.services.jobs.generation_jobs import (
    InMemoryGenerationJobRepository,
    SupabaseGenerationJobRepository,
)
from app.services.narration.base import NarrationProvider
from app.services.narration.speech_markup import (
    DeterministicSpeechMarkupProvider,
    SpeechMarkupProvider,
)
from app.services.pipeline.solve_snapshot import SolveGenerationService
from app.services.provider_keys.storage import ProviderKeyStorageError, SupabaseProviderKeyStore
from app.services.rendering import CommandMotionCanvasRenderer, DevelopmentMotionCanvasRenderer
from app.services.scripts.base import ScriptProvider
from app.services.scripts.development import DevelopmentScriptProvider
from app.services.storage.media_store import InMemoryMediaStore, MediaStore, SupabaseMediaStore

router = APIRouter(prefix="/generations")

_jobs = InMemoryGenerationJobRepository()
_artifacts = InMemoryArtifactRepository()
_media_store = InMemoryMediaStore(bucket="generated-media")
_solve_generations = SolveGenerationService(jobs=_jobs, artifacts=_artifacts)


@router.post("", response_model=GenerationSnapshot)
async def create_generation(
    request: SolveEquationRequest,
    current_user: Annotated[AuthenticatedUser, Depends(get_current_user)],
    settings: Annotated[Settings, Depends(get_settings)],
) -> GenerationSnapshot:
    service, _media_store_for_request = _generation_services(settings)
    return service.create_generation(
        user_id=current_user.id,
        equation=request.equation,
        instructor_id=request.instructor_id,
    )


@router.get("/latest", response_model=GenerationSnapshot | None)
async def get_latest_generation(
    current_user: Annotated[AuthenticatedUser, Depends(get_current_user)],
    settings: Annotated[Settings, Depends(get_settings)],
) -> GenerationSnapshot | None:
    service, _media_store_for_request = _generation_services(settings)
    return service.get_latest_snapshot(user_id=current_user.id)


@router.get("/latest/video", response_model=LatestGenerationVideo | None)
async def get_latest_generation_video(
    current_user: Annotated[AuthenticatedUser, Depends(get_current_user)],
    settings: Annotated[Settings, Depends(get_settings)],
) -> LatestGenerationVideo | None:
    service, _media_store_for_request = _generation_services(settings)
    return service.get_latest_video(user_id=current_user.id)


@router.get("/latest/videos", response_model=LatestGenerationVideos)
async def get_latest_generation_videos(
    current_user: Annotated[AuthenticatedUser, Depends(get_current_user)],
    settings: Annotated[Settings, Depends(get_settings)],
) -> LatestGenerationVideos:
    service, _media_store_for_request = _generation_services(settings)
    return service.get_latest_render_videos(user_id=current_user.id, limit=3)


@router.get("/public/latest-renders", response_model=PublicLatestRenderVideos)
async def get_public_latest_render_videos(
    settings: Annotated[Settings, Depends(get_settings)],
) -> PublicLatestRenderVideos:
    service, _media_store_for_request = _generation_services(settings)
    return service.get_public_latest_render_videos(limit=3)


@router.get("/{generation_id}", response_model=GenerationSnapshot)
async def get_generation(
    generation_id: str,
    current_user: Annotated[AuthenticatedUser, Depends(get_current_user)],
    settings: Annotated[Settings, Depends(get_settings)],
) -> GenerationSnapshot:
    service, _media_store_for_request = _generation_services(settings)
    snapshot = service.get_snapshot(
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
    service, media_store = _generation_services(settings)
    if stage == "teacher_script":
        snapshot = service.get_snapshot(
            generation_job_id=generation_id,
            user_id=current_user.id,
        )
        if snapshot is None:
            raise HTTPException(status_code=404, detail="Generation not found")
        return await service.run_teacher_script(
            generation_job_id=generation_id,
            user_id=current_user.id,
            provider=_script_provider(settings),
            instructor_id=snapshot.job.instructor_id,
            output_mode="audio",
            word_budget=settings.script_word_budget,
            usage_costs=_usage_repository(settings),
            input_token_cost_per_million_usd=settings.openai_gpt5_mini_input_cost_per_million_tokens_usd,
            output_token_cost_per_million_usd=settings.openai_gpt5_mini_output_cost_per_million_tokens_usd,
            force=request.force,
        )
    if stage == "real_world_context":
        return await service.run_real_world_context(
            generation_job_id=generation_id,
            user_id=current_user.id,
            provider=_real_world_context_provider(settings),
            word_budget=settings.real_world_context_word_budget,
            usage_costs=_usage_repository(settings),
            input_token_cost_per_million_usd=settings.openai_gpt5_mini_input_cost_per_million_tokens_usd,
            output_token_cost_per_million_usd=settings.openai_gpt5_mini_output_cost_per_million_tokens_usd,
            force=request.force,
        )
    if stage == "elevenlabs_audio":
        snapshot = service.get_snapshot(
            generation_job_id=generation_id,
            user_id=current_user.id,
        )
        if snapshot is None:
            raise HTTPException(status_code=404, detail="Generation not found")
        return await service.run_narration(
            generation_job_id=generation_id,
            user_id=current_user.id,
            provider=_narration_provider(settings),
            speech_markup_provider=_speech_markup_provider(settings),
            media_store=media_store,
            instructor_id=snapshot.job.instructor_id,
            voice_id=await _voice_id_for_instructor(settings, snapshot.job.instructor_id),
            model_id=settings.elevenlabs_model_id,
            usage_costs=_usage_repository(settings),
            elevenlabs_cost_per_credit_usd=settings.elevenlabs_cost_per_credit_usd,
            force=request.force,
            script_segment_id=request.script_segment_id,
        )
    if stage == "animation_plan":
        snapshot = service.get_snapshot(
            generation_job_id=generation_id,
            user_id=current_user.id,
        )
        if snapshot is None:
            raise HTTPException(status_code=404, detail="Generation not found")
        try:
            provider = _animation_plan_provider(settings)
        except RuntimeError as exc:
            raise HTTPException(status_code=409, detail=str(exc)) from exc
        return await service.run_animation_plan(
            generation_job_id=generation_id,
            user_id=current_user.id,
            provider=provider,
            usage_costs=_usage_repository(settings),
            input_token_cost_per_million_usd=settings.openai_gpt5_mini_input_cost_per_million_tokens_usd,
            output_token_cost_per_million_usd=settings.openai_gpt5_mini_output_cost_per_million_tokens_usd,
            force=request.force,
        )
    if stage == "resolved_timeline":
        return service.run_resolved_timeline(
            generation_job_id=generation_id,
            user_id=current_user.id,
            force=request.force,
        )
    if stage == "heygen_avatar":
        snapshot = service.get_snapshot(
            generation_job_id=generation_id,
            user_id=current_user.id,
        )
        if snapshot is None:
            raise HTTPException(status_code=404, detail="Generation not found")
        avatar_model = _heygen_avatar_model(settings, request.avatar_model)
        return await service.run_heygen_avatar(
            generation_job_id=generation_id,
            user_id=current_user.id,
            avatar_id=await _avatar_id_for_instructor(settings, snapshot.job.instructor_id),
            provider=await _avatar_provider(settings, current_user.id),
            media_store=media_store,
            usage_costs=_usage_repository(settings),
            output_format=settings.heygen_avatar_output_format,
            avatar_model=avatar_model,
            cost_per_second_usd=_heygen_avatar_cost_per_second(settings, avatar_model),
            force=request.force,
        )
    if stage == "motion_canvas_render":
        return service.run_render(
            generation_job_id=generation_id,
            user_id=current_user.id,
            renderer=_renderer_for_settings(settings),
            media_store=media_store,
            include_avatar=request.include_avatar is True,
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
    service, media_store = _generation_services(settings)
    snapshot = service.get_snapshot(
        generation_job_id=generation_id,
        user_id=current_user.id,
    )
    if snapshot is None:
        raise HTTPException(status_code=404, detail="Generation not found")
    await service.run_teacher_script(
        generation_job_id=generation_id,
        user_id=current_user.id,
        provider=_script_provider(settings),
        instructor_id=snapshot.job.instructor_id,
        output_mode="audio",
        word_budget=settings.script_word_budget,
        usage_costs=_usage_repository(settings),
        input_token_cost_per_million_usd=settings.openai_gpt5_mini_input_cost_per_million_tokens_usd,
        output_token_cost_per_million_usd=settings.openai_gpt5_mini_output_cost_per_million_tokens_usd,
        force=request.force,
    )
    await service.run_narration(
        generation_job_id=generation_id,
        user_id=current_user.id,
        provider=_narration_provider(settings),
        speech_markup_provider=_speech_markup_provider(settings),
        media_store=media_store,
        instructor_id=snapshot.job.instructor_id,
        voice_id=await _voice_id_for_instructor(settings, snapshot.job.instructor_id),
        model_id=settings.elevenlabs_model_id,
        usage_costs=_usage_repository(settings),
        elevenlabs_cost_per_credit_usd=settings.elevenlabs_cost_per_credit_usd,
        force=request.force,
        script_segment_id=request.script_segment_id,
    )
    await service.run_animation_plan(
        generation_job_id=generation_id,
        user_id=current_user.id,
        provider=_animation_plan_provider(settings),
        usage_costs=_usage_repository(settings),
        input_token_cost_per_million_usd=settings.openai_gpt5_mini_input_cost_per_million_tokens_usd,
        output_token_cost_per_million_usd=settings.openai_gpt5_mini_output_cost_per_million_tokens_usd,
        force=request.force,
    )
    service.run_resolved_timeline(
        generation_job_id=generation_id,
        user_id=current_user.id,
        force=request.force,
    )
    return service.run_render(
        generation_job_id=generation_id,
        user_id=current_user.id,
        renderer=_renderer_for_settings(settings),
        media_store=media_store,
        force=request.force,
    )


def _script_provider(settings: Settings) -> ScriptProvider:
    if not settings.script_generation_enabled:
        return DevelopmentScriptProvider()
    return OpenAIScriptProvider(
        api_key=settings.openai_api_key,
        model=settings.openai_script_model,
    )


def _real_world_context_provider(settings: Settings) -> RealWorldContextProvider:
    if not settings.script_generation_enabled:
        return DevelopmentRealWorldContextProvider()
    return OpenAIRealWorldContextProvider(
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


async def _avatar_provider(settings: Settings, user_id: str) -> AvatarVideoProvider:
    if settings.app_environment == "test":
        return DevelopmentAvatarVideoProvider()
    api_key = settings.heygen_api_key.strip()
    stored_key = None
    try:
        stored_key = await SupabaseProviderKeyStore(settings).get_decrypted(user_id, "heygen")
    except ProviderKeyStorageError as exc:
        if not api_key and settings.app_environment == "development":
            return DevelopmentAvatarVideoProvider()
        if not api_key:
            raise HTTPException(status_code=503, detail=str(exc)) from exc
    if stored_key is not None:
        api_key = stored_key.api_key
    if not api_key:
        if settings.app_environment == "development":
            return DevelopmentAvatarVideoProvider()
        raise HTTPException(status_code=409, detail="HeyGen API key is not configured")
    return HeyGenAvatarVideoProvider(
        api_key=api_key,
        poll_interval_seconds=settings.heygen_avatar_poll_interval_seconds,
        timeout_seconds=settings.heygen_avatar_timeout_seconds,
    )


def _heygen_avatar_model(settings: Settings, requested_model: str | None) -> str:
    model = (requested_model or settings.heygen_avatar_default_model).strip() or "avatar_iii"
    if model not in {"avatar_iii", "avatar_iv", "avatar_v"}:
        raise HTTPException(status_code=400, detail=f"Unsupported HeyGen avatar model '{model}'")
    return model


def _heygen_avatar_cost_per_second(settings: Settings, avatar_model: str) -> float:
    if avatar_model == "avatar_iii":
        return settings.heygen_avatar_iii_cost_per_second_usd
    if avatar_model == "avatar_iv":
        return settings.heygen_avatar_iv_cost_per_second_usd
    if avatar_model == "avatar_v":
        return settings.heygen_avatar_v_cost_per_second_usd
    return settings.heygen_avatar_cost_per_second_usd


def _speech_markup_provider(settings: Settings) -> SpeechMarkupProvider:
    if not settings.script_generation_enabled:
        return DeterministicSpeechMarkupProvider()
    return OpenAISpeechMarkupProvider(
        api_key=settings.openai_api_key,
        model=settings.openai_script_model,
    )


def _generation_services(settings: Settings) -> tuple[SolveGenerationService, MediaStore]:
    if settings.app_environment == "test":
        return _solve_generations, _media_store
    if settings.supabase_url and settings.supabase_service_role_key:
        media_store = SupabaseMediaStore(settings, bucket=settings.generated_media_bucket)
        artifacts = SupabaseArtifactRepository(
            settings,
            signed_url_resolver=lambda bucket, path: media_store.signed_url(
                bucket=bucket,
                path=path,
            ),
        )
        return (
            SolveGenerationService(
                jobs=SupabaseGenerationJobRepository(settings),  # type: ignore[arg-type]
                artifacts=artifacts,  # type: ignore[arg-type]
            ),
            media_store,
        )
    return _solve_generations, _media_store


def _renderer_for_settings(
    settings: Settings,
) -> DevelopmentMotionCanvasRenderer | CommandMotionCanvasRenderer:
    if settings.motion_canvas_render_command:
        return CommandMotionCanvasRenderer(
            command=settings.motion_canvas_render_command,
            cwd=settings.motion_canvas_render_cwd or None,
            timeout_seconds=settings.motion_canvas_render_timeout_seconds,
        )
    return DevelopmentMotionCanvasRenderer()


async def _voice_id_for_instructor(settings: Settings, instructor_id: str | None) -> str:
    instructor = await _instructor_repository(settings).get(instructor_id)
    return instructor.voice_id if instructor and instructor.voice_id else ""


async def _avatar_id_for_instructor(settings: Settings, instructor_id: str | None) -> str:
    instructor = await _instructor_repository(settings).get(instructor_id)
    if instructor and instructor.avatar_id:
        return instructor.avatar_id
    raise HTTPException(
        status_code=409,
        detail="HeyGen avatar ID is not configured for this instructor",
    )
