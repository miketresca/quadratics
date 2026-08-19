import pytest
from httpx import ASGITransport, AsyncClient

from app.api.routes import equations
from app.core.config import Settings, get_settings
from app.schemas.narration import AudioAlignment
from app.schemas.script import LessonScript, ScriptSegment
from app.services.narration.base import NarrationProvider, NarrationRequest, NarrationResult
from app.services.scripts.base import ScriptGenerationRequest, ScriptProvider


class RecordingScriptProvider(ScriptProvider):
    def __init__(self) -> None:
        self.requests: list[ScriptGenerationRequest] = []

    async def generate_lesson_script(self, request: ScriptGenerationRequest) -> LessonScript:
        self.requests.append(request)
        return LessonScript(
            status="completed",
            method="factoring",
            segments=[
                ScriptSegment(
                    id="script_factor",
                    step_id="factor",
                    title="Factor the quadratic",
                    narration="First factor the quadratic into the two factors shown.",
                    math_line_ids=["standard_form", "factored_form"],
                    estimated_seconds=8,
                    word_count=9,
                ),
                ScriptSegment(
                    id="script_solve_factors",
                    step_id="solve_factors",
                    title="Solve each factor",
                    narration="Next use the zero product property and solve each factor.",
                    math_line_ids=[
                        "first_factor",
                        "first_isolate_x_term",
                        "first_solution",
                        "second_factor",
                        "second_solution",
                    ],
                    estimated_seconds=10,
                    word_count=10,
                ),
                ScriptSegment(
                    id="script_final_answer",
                    step_id="final_answer",
                    title="State the final answer",
                    narration="The solutions are one half and three.",
                    math_line_ids=["solutions"],
                    estimated_seconds=6,
                    word_count=7,
                ),
            ],
            provider_metadata={"provider": "recording-test"},
        )


class RecordingNarrationProvider(NarrationProvider):
    def __init__(self) -> None:
        self.requests: list[NarrationRequest] = []

    async def generate(self, request: NarrationRequest) -> NarrationResult:
        self.requests.append(request)
        return NarrationResult(
            provider="elevenlabs",
            audio_base64="ZmFrZS1tcDM=",
            audio_mime_type="audio/mpeg",
            duration_seconds=3.2,
            normalized_alignment=AudioAlignment(
                characters=["H", "i"],
                character_start_times_seconds=[0, 0.2],
                character_end_times_seconds=[0.2, 0.4],
            ),
            provider_metadata={"model": "eleven_multilingual_v2"},
        )


class PaymentRequiredNarrationProvider(NarrationProvider):
    async def generate(self, request: NarrationRequest) -> NarrationResult:
        raise RuntimeError(
            "ElevenLabs payment is required or the account has insufficient credits."
        )


class FailsAfterFirstNarrationProvider(RecordingNarrationProvider):
    async def generate(self, request: NarrationRequest) -> NarrationResult:
        if self.requests:
            self.requests.append(request)
            raise RuntimeError("ElevenLabs audio generation failed on the second segment.")
        return await super().generate(request)


@pytest.mark.asyncio
async def test_script_endpoint_returns_factoring_lesson_and_script(app, authenticated_client):
    app.dependency_overrides[get_settings] = lambda: Settings(script_generation_enabled=False)
    try:
        response = await authenticated_client.post(
            "/api/v1/equations/script",
            json={
                "equation": "2*x^2 - 7*x + 3",
                "instructorId": "male",
                "outputMode": "video_audio",
            },
        )
    finally:
        app.dependency_overrides.pop(get_settings, None)

    assert response.status_code == 200
    body = response.json()
    assert body["lesson"]["method"] == "factoring"
    assert body["script"]["status"] == "completed"
    assert [segment["stepId"] for segment in body["script"]["segments"]] == [
        "factor",
        "solve_factors",
        "final_answer",
    ]
    lesson_line_ids = {
        line["id"]
        for step in body["lesson"]["steps"]
        for line in step["mathLines"]
    }
    script_line_ids = {
        line_id
        for segment in body["script"]["segments"]
        for line_id in segment["mathLineIds"]
    }
    assert script_line_ids <= lesson_line_ids


@pytest.mark.asyncio
async def test_script_endpoint_can_use_injected_provider_when_generation_is_enabled(
    app,
    authenticated_client,
    monkeypatch,
):
    provider = RecordingScriptProvider()
    app.dependency_overrides[get_settings] = lambda: Settings(script_generation_enabled=True)
    monkeypatch.setattr(equations, "_script_provider", lambda _settings, _lesson: provider)

    try:
        response = await authenticated_client.post(
            "/api/v1/equations/script",
            json={
                "equation": "2*x^2 - 7*x + 3",
                "instructorId": "male",
                "outputMode": "audio",
            },
        )
    finally:
        app.dependency_overrides.pop(get_settings, None)

    assert response.status_code == 200
    body = response.json()
    assert body["script"]["providerMetadata"] == {"provider": "recording-test"}
    assert provider.requests
    assert provider.requests[0].lesson["steps"][0]["id"] == "factor"
    assert provider.requests[0].output_mode == "audio"


@pytest.mark.asyncio
async def test_narration_endpoint_generates_audio_for_completed_audio_script(
    app,
    authenticated_client,
    monkeypatch,
):
    provider = RecordingNarrationProvider()
    app.dependency_overrides[get_settings] = lambda: Settings(
        script_generation_enabled=False,
        elevenlabs_api_key="test-key",
    )
    monkeypatch.setattr(equations, "_narration_provider", lambda _settings: provider)

    script = RecordingScriptProvider()
    completed_script = await script.generate_lesson_script(
        ScriptGenerationRequest(
            lesson={},
            instructor_id="male",
            output_mode="audio",
            prompt="",
            word_budget=150,
        )
    )

    try:
        response = await authenticated_client.post(
            "/api/v1/equations/narration",
            json={
                "script": completed_script.model_dump(mode="json", by_alias=True),
                "instructorId": "male",
                "outputMode": "audio",
            },
        )
    finally:
        app.dependency_overrides.pop(get_settings, None)

    assert response.status_code == 200
    body = response.json()
    assert body["narration"]["status"] == "completed"
    assert body["narration"]["segments"] == [
        {
            "scriptSegmentId": "script_factor",
            "stepId": "factor",
            "title": "Factor the quadratic",
            "provider": "elevenlabs",
            "voiceId": "male-voice",
            "modelId": "eleven_multilingual_v2",
            "audioMimeType": "audio/mpeg",
            "audioBase64": "ZmFrZS1tcDM=",
            "durationSeconds": 3.2,
            "speechText": "First factor the quadratic into the two factors shown.",
            "alignment": None,
            "normalizedAlignment": {
                "characters": ["H", "i"],
                "characterStartTimesSeconds": [0.0, 0.2],
                "characterEndTimesSeconds": [0.2, 0.4],
            },
            "providerMetadata": {
                "model": "eleven_multilingual_v2",
                "segmentOffsetSeconds": 0.0,
            },
        },
        {
            "scriptSegmentId": "script_solve_factors",
            "stepId": "solve_factors",
            "title": "Solve each factor",
            "provider": "elevenlabs",
            "voiceId": "male-voice",
            "modelId": "eleven_multilingual_v2",
            "audioMimeType": "audio/mpeg",
            "audioBase64": "ZmFrZS1tcDM=",
            "durationSeconds": 3.2,
            "speechText": "Next use the zero product property and solve each factor.",
            "alignment": None,
            "normalizedAlignment": {
                "characters": ["H", "i"],
                "characterStartTimesSeconds": [0.0, 0.2],
                "characterEndTimesSeconds": [0.2, 0.4],
            },
            "providerMetadata": {
                "model": "eleven_multilingual_v2",
                "segmentOffsetSeconds": 3.2,
            },
        },
        {
            "scriptSegmentId": "script_final_answer",
            "stepId": "final_answer",
            "title": "State the final answer",
            "provider": "elevenlabs",
            "voiceId": "male-voice",
            "modelId": "eleven_multilingual_v2",
            "audioMimeType": "audio/mpeg",
            "audioBase64": "ZmFrZS1tcDM=",
            "durationSeconds": 3.2,
            "speechText": "The solutions are one half and three.",
            "alignment": None,
            "normalizedAlignment": {
                "characters": ["H", "i"],
                "characterStartTimesSeconds": [0.0, 0.2],
                "characterEndTimesSeconds": [0.2, 0.4],
            },
            "providerMetadata": {
                "model": "eleven_multilingual_v2",
                "segmentOffsetSeconds": 6.4,
            },
        },
    ]
    assert body["narration"]["voiceId"] == "male-voice"
    assert body["narration"]["providerMetadata"] == {
        "model": "eleven_multilingual_v2",
        "segmentCount": 3,
    }
    assert [request.step_id for request in provider.requests] == [
        "factor",
        "solve_factors",
        "final_answer",
    ]


@pytest.mark.asyncio
async def test_narration_endpoint_can_generate_one_script_segment(
    app,
    authenticated_client,
    monkeypatch,
):
    provider = RecordingNarrationProvider()
    app.dependency_overrides[get_settings] = lambda: Settings(
        script_generation_enabled=False,
        elevenlabs_api_key="test-key",
    )
    monkeypatch.setattr(equations, "_narration_provider", lambda _settings: provider)

    script = RecordingScriptProvider()
    completed_script = await script.generate_lesson_script(
        ScriptGenerationRequest(
            lesson={},
            instructor_id="male",
            output_mode="audio",
            prompt="",
            word_budget=150,
        )
    )

    try:
        response = await authenticated_client.post(
            "/api/v1/equations/narration",
            json={
                "script": completed_script.model_dump(mode="json", by_alias=True),
                "scriptSegmentId": "script_solve_factors",
                "instructorId": "male",
                "outputMode": "audio",
            },
        )
    finally:
        app.dependency_overrides.pop(get_settings, None)

    assert response.status_code == 200
    body = response.json()
    assert body["narration"]["status"] == "completed"
    assert body["narration"]["segments"][0]["scriptSegmentId"] == "script_solve_factors"
    assert body["narration"]["audioBase64"] == "ZmFrZS1tcDM="
    assert [request.step_id for request in provider.requests] == ["solve_factors"]


@pytest.mark.asyncio
async def test_narration_endpoint_returns_unsupported_for_unknown_script_segment(
    app,
    authenticated_client,
    monkeypatch,
):
    provider = RecordingNarrationProvider()
    app.dependency_overrides[get_settings] = lambda: Settings(
        script_generation_enabled=False,
        elevenlabs_api_key="test-key",
    )
    monkeypatch.setattr(equations, "_narration_provider", lambda _settings: provider)

    script = RecordingScriptProvider()
    completed_script = await script.generate_lesson_script(
        ScriptGenerationRequest(
            lesson={},
            instructor_id="male",
            output_mode="audio",
            prompt="",
            word_budget=150,
        )
    )

    try:
        response = await authenticated_client.post(
            "/api/v1/equations/narration",
            json={
                "script": completed_script.model_dump(mode="json", by_alias=True),
                "scriptSegmentId": "missing_segment",
                "instructorId": "male",
                "outputMode": "audio",
            },
        )
    finally:
        app.dependency_overrides.pop(get_settings, None)

    assert response.status_code == 200
    body = response.json()
    assert body["narration"]["status"] == "unsupported"
    assert "missing_segment" in body["narration"]["unsupportedReason"]
    assert provider.requests == []


@pytest.mark.asyncio
async def test_narration_endpoint_returns_unsupported_without_voice_id(
    app, authenticated_client, monkeypatch
):
    script = RecordingScriptProvider()
    completed_script = await script.generate_lesson_script(
        ScriptGenerationRequest(
            lesson={},
            instructor_id="male",
            output_mode="audio",
            prompt="",
            word_budget=150,
        )
    )

    app.dependency_overrides[get_settings] = lambda: Settings(
        script_generation_enabled=False,
        elevenlabs_api_key="test-key",
    )

    async def empty_voice_id(_settings, _instructor_id):
        return ""

    monkeypatch.setattr(equations, "_voice_id_for_instructor", empty_voice_id)
    try:
        response = await authenticated_client.post(
            "/api/v1/equations/narration",
            json={
                "script": completed_script.model_dump(mode="json", by_alias=True),
                "instructorId": "male",
                "outputMode": "audio",
            },
        )
    finally:
        app.dependency_overrides.pop(get_settings, None)

    assert response.status_code == 200
    body = response.json()
    assert body["narration"]["status"] == "unsupported"
    assert "voice is not configured" in body["narration"]["unsupportedReason"]


@pytest.mark.asyncio
async def test_narration_endpoint_keeps_speech_text_when_provider_fails(
    app,
    authenticated_client,
    monkeypatch,
):
    script = RecordingScriptProvider()
    completed_script = await script.generate_lesson_script(
        ScriptGenerationRequest(
            lesson={},
            instructor_id="male",
            output_mode="audio",
            prompt="",
            word_budget=150,
        )
    )

    provider = PaymentRequiredNarrationProvider()
    app.dependency_overrides[get_settings] = lambda: Settings(
        script_generation_enabled=False,
        elevenlabs_api_key="test-key",
    )
    monkeypatch.setattr(equations, "_narration_provider", lambda _settings: provider)

    try:
        response = await authenticated_client.post(
            "/api/v1/equations/narration",
            json={
                "script": completed_script.model_dump(mode="json", by_alias=True),
                "instructorId": "male",
                "outputMode": "audio",
            },
        )
    finally:
        app.dependency_overrides.pop(get_settings, None)

    assert response.status_code == 200
    body = response.json()
    assert body["narration"]["status"] == "failed"
    assert "insufficient credits" in body["narration"]["unsupportedReason"]
    assert body["narration"]["speechText"] == (
        "First factor the quadratic into the two factors shown."
    )


@pytest.mark.asyncio
async def test_narration_endpoint_keeps_attempted_speech_text_when_later_segment_fails(
    app,
    authenticated_client,
    monkeypatch,
):
    script = RecordingScriptProvider()
    completed_script = await script.generate_lesson_script(
        ScriptGenerationRequest(
            lesson={},
            instructor_id="male",
            output_mode="audio",
            prompt="",
            word_budget=150,
        )
    )

    provider = FailsAfterFirstNarrationProvider()
    app.dependency_overrides[get_settings] = lambda: Settings(
        script_generation_enabled=False,
        elevenlabs_api_key="test-key",
    )
    monkeypatch.setattr(equations, "_narration_provider", lambda _settings: provider)

    try:
        response = await authenticated_client.post(
            "/api/v1/equations/narration",
            json={
                "script": completed_script.model_dump(mode="json", by_alias=True),
                "instructorId": "male",
                "outputMode": "audio",
            },
        )
    finally:
        app.dependency_overrides.pop(get_settings, None)

    assert response.status_code == 200
    body = response.json()
    assert body["narration"]["status"] == "failed"
    assert "second segment" in body["narration"]["unsupportedReason"]
    assert [segment["scriptSegmentId"] for segment in body["narration"]["segments"]] == [
        "script_factor"
    ]
    assert body["narration"]["segments"][0]["audioBase64"] == "ZmFrZS1tcDM="
    assert body["narration"]["speechText"] == (
        "First factor the quadratic into the two factors shown. "
        "Next use the zero product property and solve each factor."
    )
    assert [request.step_id for request in provider.requests] == ["factor", "solve_factors"]


@pytest.mark.asyncio
async def test_script_endpoint_returns_unsupported_script_for_unsupported_lesson(
    app,
    authenticated_client,
):
    app.dependency_overrides[get_settings] = lambda: Settings(script_generation_enabled=True)
    try:
        response = await authenticated_client.post(
            "/api/v1/equations/script",
            json={"equation": "x^2 + x + 1", "outputMode": "audio"},
        )
    finally:
        app.dependency_overrides.pop(get_settings, None)

    assert response.status_code == 200
    body = response.json()
    assert body["lesson"]["status"] == "unsupported_instructional_method"
    assert body["script"]["status"] == "unsupported"
    assert body["script"]["segments"] == []


@pytest.mark.asyncio
async def test_script_endpoint_rejects_unauthenticated_requests(client):
    response = await client.post(
        "/api/v1/equations/script",
        json={"equation": "2*x^2 - 7*x + 3"},
    )

    assert response.status_code == 401


@pytest.mark.asyncio
async def test_script_endpoint_rejects_dev_token(app):
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        response = await client.post(
            "/api/v1/equations/script",
            headers={"Authorization": "Bearer dev"},
            json={"equation": "2*x^2 - 7*x + 3"},
        )

    assert response.status_code == 401


@pytest.mark.asyncio
async def test_solve_endpoint_still_returns_only_lesson(authenticated_client):
    response = await authenticated_client.post(
        "/api/v1/equations/solve",
        json={"equation": "2*x^2 - 7*x + 3"},
    )

    assert response.status_code == 200
    body = response.json()
    assert "script" not in body
    assert body["method"] == "factoring"
