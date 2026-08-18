import pytest

from app.schemas.script import LessonScript, ScriptSegment
from app.services.lessons.builder import build_lesson
from app.services.math.parser import parse_equation
from app.services.math.solver import solve_quadratic
from app.services.math.validator import validate_quadratic
from app.services.scripts.base import ScriptGenerationRequest, ScriptProvider
from app.services.scripts.builder import build_lesson_script
from app.services.scripts.validator import ScriptValidationError


class FakeScriptProvider(ScriptProvider):
    def __init__(self, script: LessonScript | None = None) -> None:
        self.script = script
        self.requests: list[ScriptGenerationRequest] = []

    async def generate_lesson_script(self, request: ScriptGenerationRequest) -> LessonScript:
        self.requests.append(request)
        if self.script is None:
            return completed_factoring_script()
        return self.script


def completed_factoring_script(
    *,
    method: str = "factoring",
    solve_math_line_ids: list[str] | None = None,
) -> LessonScript:
    return LessonScript(
        status="completed",
        method=method,  # type: ignore[arg-type]
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
                math_line_ids=solve_math_line_ids
                or [
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
    )


def factoring_lesson():
    solution = solve_quadratic(validate_quadratic(parse_equation("2*x^2 - 7*x + 3")))
    return build_lesson(solution)


@pytest.mark.asyncio
async def test_script_builder_uses_lesson_context_for_provider_request():
    provider = FakeScriptProvider()
    lesson = factoring_lesson()

    script = await build_lesson_script(
        lesson=lesson,
        provider=provider,
        instructor_id="male",
        output_mode="video_audio",
        word_budget=150,
    )

    assert script.status == "completed"
    assert script.total_word_count == 26
    assert [segment.step_id for segment in script.segments] == [
        "factor",
        "solve_factors",
        "final_answer",
    ]
    assert provider.requests
    request = provider.requests[0]
    assert request.lesson["normalizedEquation"] == "2*x**2 - 7*x + 3 = 0"
    assert request.lesson["steps"][0]["mathLines"][0]["id"] == "standard_form"
    assert request.instructor_id == "male"
    assert request.output_mode == "video_audio"
    assert "source of mathematical truth" in request.prompt


@pytest.mark.asyncio
async def test_script_builder_rejects_unknown_math_line_reference():
    provider = FakeScriptProvider(
        completed_factoring_script(solve_math_line_ids=["first_factor", "not_a_line"])
    )

    with pytest.raises(ScriptValidationError, match="unknown math line ids"):
        await build_lesson_script(
            lesson=factoring_lesson(),
            provider=provider,
            instructor_id="male",
            output_mode="audio",
            word_budget=150,
        )


@pytest.mark.asyncio
async def test_script_builder_rejects_provider_method_mismatch():
    provider = FakeScriptProvider(completed_factoring_script(method="quadratic_formula"))

    with pytest.raises(ScriptValidationError, match="script method must match"):
        await build_lesson_script(
            lesson=factoring_lesson(),
            provider=provider,
            instructor_id="male",
            output_mode="audio",
            word_budget=150,
        )


@pytest.mark.asyncio
async def test_script_builder_does_not_call_provider_for_unsupported_lesson():
    provider = FakeScriptProvider()
    solution = solve_quadratic(validate_quadratic(parse_equation("x^2 + x + 1")))
    lesson = build_lesson(solution)

    script = await build_lesson_script(
        lesson=lesson,
        provider=provider,
        instructor_id="female",
        output_mode="audio",
        word_budget=150,
    )

    assert script.status == "unsupported"
    assert script.unsupported_reason
    assert provider.requests == []


@pytest.mark.asyncio
async def test_script_builder_rejects_word_budget_overflow():
    provider = FakeScriptProvider()

    with pytest.raises(ScriptValidationError):
        await build_lesson_script(
            lesson=factoring_lesson(),
            provider=provider,
            instructor_id="male",
            output_mode="audio",
            word_budget=5,
        )
