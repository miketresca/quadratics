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


def test_factoring_lesson_includes_intermediate_factor_lines():
    solution = solve_quadratic(validate_quadratic(parse_equation("2*x^2 - 7*x + 3 = 0")))
    lesson = build_lesson(solution)

    expressions = [line.expression for step in lesson.steps for line in step.math_lines]

    assert expressions == [
        "2*x^2 - 7*x + 3 = 0",
        "(2*x - 1)*(x - 3) = 0",
        "2*x - 1 = 0",
        "2*x = 1",
        "x = 1/2",
        "x - 3 = 0",
        "x = 3",
        "x = 1/2, 3",
    ]


def test_another_supported_factorable_quadratic_has_full_line_sequence():
    solution = solve_quadratic(validate_quadratic(parse_equation("x^2 - 5*x + 6 = 0")))
    lesson = build_lesson(solution)

    expressions = [line.expression for step in lesson.steps for line in step.math_lines]

    assert expressions == [
        "x^2 - 5*x + 6 = 0",
        "(x - 3)*(x - 2) = 0",
        "x - 3 = 0",
        "x = 3",
        "x - 2 = 0",
        "x = 2",
        "x = 2, 3",
    ]
    assert all(
        line.id and line.expression and line.latex
        for step in lesson.steps
        for line in step.math_lines
    )


def test_repeated_factor_quadratic_remains_unsupported():
    solution = solve_quadratic(validate_quadratic(parse_equation("x^2 - 2*x + 1 = 0")))
    lesson = build_lesson(solution)

    assert lesson.status == "unsupported_instructional_method"
    assert lesson.steps == []


def test_factor_with_zero_constant_does_not_add_redundant_isolation_line():
    solution = solve_quadratic(validate_quadratic(parse_equation("x^2 - x = 0")))
    lesson = build_lesson(solution)

    expressions = [line.expression for step in lesson.steps for line in step.math_lines]

    assert expressions == [
        "x^2 - x = 0",
        "(x - 1)*(x) = 0",
        "x - 1 = 0",
        "x = 1",
        "x = 0",
        "x = 0",
        "x = 0, 1",
    ]
