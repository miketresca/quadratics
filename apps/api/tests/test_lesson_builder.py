from app.services.lessons.builder import build_lesson
from app.services.math.parser import parse_equation
from app.services.math.solver import solve_quadratic
from app.services.math.validator import validate_quadratic


def test_factoring_lesson_teaching_steps_are_grouped():
    solution = solve_quadratic(validate_quadratic(parse_equation("2*x^2 - 7*x + 3 = 0")))
    lesson = build_lesson(solution)

    assert [step.id for step in lesson.steps] == ["factor", "solve_factors", "final_answer"]
    assert [step.title for step in lesson.steps] == [
        "Factor the quadratic",
        "Solve each factor",
        "State the final answer",
    ]
    assert [line.expression for line in lesson.steps[-1].math_lines] == ["x = 1/2, 3"]
