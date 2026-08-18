from app.schemas.script import LessonScript, ScriptSegment
from app.services.scripts.base import ScriptGenerationRequest, ScriptProvider


class DevelopmentScriptProvider(ScriptProvider):
    async def generate_lesson_script(self, request: ScriptGenerationRequest) -> LessonScript:
        lesson = request.lesson
        steps = {step["id"]: step for step in lesson["steps"]}
        solutions = ", ".join(solution["expression"] for solution in lesson["solutions"])
        factored_form = _line_expression(steps["factor"], "factored_form")

        segments = [
            _segment(
                segment_id="script_factor",
                step=steps["factor"],
                narration=(
                    "First, factor the quadratic. The expression rewrites as "
                    f"{factored_form}, which lets us use the zero product property."
                ),
            ),
            _segment(
                segment_id="script_solve_factors",
                step=steps["solve_factors"],
                narration=(
                    "Now set each factor equal to zero. Solving the first factor gives "
                    f"{_line_expression(steps['solve_factors'], 'first_solution')}, and solving "
                    "the second factor gives "
                    f"{_line_expression(steps['solve_factors'], 'second_solution')}."
                ),
            ),
            _segment(
                segment_id="script_final_answer",
                step=steps["final_answer"],
                narration=(
                    f"So the solutions are {solutions}. These are the x values that make "
                    "the original quadratic equal zero."
                ),
            ),
        ]

        return LessonScript(
            status="completed",
            method="factoring",
            segments=segments,
            provider_metadata={"provider": "development"},
        )


def _segment(*, segment_id: str, step: dict, narration: str) -> ScriptSegment:
    return ScriptSegment(
        id=segment_id,
        step_id=step["id"],
        title=step["title"],
        narration=narration,
        math_line_ids=[line["id"] for line in step["mathLines"]],
        estimated_seconds=max(4, round(len(narration.split()) / 2.7, 1)),
        word_count=len(narration.split()),
    )


def _line_expression(step: dict, line_id: str) -> str:
    for line in step["mathLines"]:
        if line["id"] == line_id:
            return line["expression"]
    return step["mathLines"][-1]["expression"]
