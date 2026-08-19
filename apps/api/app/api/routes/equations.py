from typing import Annotated

from fastapi import APIRouter, Depends

from app.api.dependencies.auth import get_current_user
from app.api.routes.instructors import _instructor_repository
from app.core.config import Settings, get_settings
from app.core.security import AuthenticatedUser
from app.providers.elevenlabs.narration_provider import (
    ElevenLabsNarrationProvider,
    NarrationProviderConfigurationError,
)
from app.providers.openai.script_provider import (
    OpenAIScriptProvider,
    ScriptProviderConfigurationError,
)
from app.providers.openai.speech_markup_provider import (
    OpenAISpeechMarkupProvider,
    SpeechMarkupProviderConfigurationError,
)
from app.schemas.equation import SolveEquationRequest
from app.schemas.lesson import LessonResponse
from app.schemas.script import (
    LessonScript,
    NarrationEquationRequest,
    NarrationEquationResponse,
    ScriptEquationRequest,
    ScriptEquationResponse,
)
from app.services.narration.base import NarrationProvider
from app.services.narration.builder import build_lesson_narration, unsupported_narration
from app.services.narration.speech_markup import (
    DeterministicSpeechMarkupProvider,
    SpeechMarkupProvider,
)
from app.services.pipeline.solve_snapshot import lesson_from_equation
from app.services.scripts.builder import build_lesson_script
from app.services.scripts.development import DevelopmentScriptProvider
from app.services.scripts.validator import ScriptValidationError

router = APIRouter(prefix="/equations")


@router.post("/solve", response_model=LessonResponse)
async def solve_equation(
    request: SolveEquationRequest,
    _current_user: Annotated[AuthenticatedUser, Depends(get_current_user)],
) -> LessonResponse:
    return lesson_from_equation(request.equation)


@router.post("/script", response_model=ScriptEquationResponse)
async def script_equation(
    request: ScriptEquationRequest,
    _current_user: Annotated[AuthenticatedUser, Depends(get_current_user)],
    settings: Annotated[Settings, Depends(get_settings)],
) -> ScriptEquationResponse:
    lesson = lesson_from_equation(request.equation)
    try:
        provider = _script_provider(settings, lesson)
        script = await build_lesson_script(
            lesson=lesson,
            provider=provider,
            instructor_id=request.instructor_id,
            output_mode=request.output_mode,
            word_budget=settings.script_word_budget,
        )
    except (ScriptProviderConfigurationError, ScriptValidationError, ValueError) as exc:
        script = LessonScript(
            status="failed",
            method=lesson.method,
            unsupported_reason=str(exc),
        )
    return ScriptEquationResponse(lesson=lesson, script=script)


@router.post("/narration", response_model=NarrationEquationResponse)
async def narrate_equation(
    request: NarrationEquationRequest,
    _current_user: Annotated[AuthenticatedUser, Depends(get_current_user)],
    settings: Annotated[Settings, Depends(get_settings)],
) -> NarrationEquationResponse:
    try:
        provider = _narration_provider(settings)
        narration = await build_lesson_narration(
            script=request.script,
            provider=provider,
            instructor_id=request.instructor_id,
            output_mode=request.output_mode,
            voice_id=await _voice_id_for_instructor(settings, request.instructor_id),
            model_id=settings.elevenlabs_model_id,
            speech_markup_provider=_speech_markup_provider(settings),
            script_segment_id=request.script_segment_id,
        )
    except (
        NarrationProviderConfigurationError,
        SpeechMarkupProviderConfigurationError,
        ValueError,
        RuntimeError,
    ) as exc:
        narration = unsupported_narration(str(exc))
    return NarrationEquationResponse(narration=narration)


def _script_provider(
    settings: Settings,
    lesson: LessonResponse,
) -> DevelopmentScriptProvider | OpenAIScriptProvider:
    if (
        not settings.script_generation_enabled
        or lesson.status != "completed"
        or lesson.method != "factoring"
    ):
        return DevelopmentScriptProvider()
    return OpenAIScriptProvider(
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


async def _voice_id_for_instructor(settings: Settings, instructor_id: str | None) -> str:
    instructor = await _instructor_repository(settings).get(instructor_id)
    return instructor.voice_id if instructor and instructor.voice_id else ""
