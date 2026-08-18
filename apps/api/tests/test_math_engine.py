import pytest

from app.services.lessons.builder import build_lesson
from app.services.math.parser import EquationParseError, parse_equation
from app.services.math.solver import solve_quadratic
from app.services.math.validator import QuadraticValidationError, validate_quadratic


def solve(equation: str):
    return solve_quadratic(validate_quadratic(parse_equation(equation)))


def test_valid_factorable_quadratic():
    solution = solve("2*x^2 - 7*x + 3 = 0")

    assert str(solution.quadratic.a) == "2"
    assert str(solution.quadratic.b) == "-7"
    assert str(solution.quadratic.c) == "3"
    assert {str(root) for root in solution.roots} == {"1/2", "3"}
    assert build_lesson(solution).method == "factoring"


def test_another_factorable_quadratic():
    solution = solve("x^2 - 5*x + 6 = 0")

    assert {str(root) for root in solution.roots} == {"2", "3"}
    assert build_lesson(solution).method == "factoring"


@pytest.mark.parametrize("equation", ["2*x + 3 = 0", "x^3 + 2*x + 1 = 0"])
def test_rejects_non_quadratics(equation: str):
    with pytest.raises(QuadraticValidationError):
        validate_quadratic(parse_equation(equation))


def test_rejects_invalid_expression():
    with pytest.raises(EquationParseError):
        parse_equation("hello world")


def test_rejects_unsupported_variables():
    with pytest.raises(EquationParseError):
        parse_equation("x^2 + y = 0")


def test_valid_non_factorable_returns_unsupported_lesson():
    lesson = build_lesson(solve("x^2 + x + 1 = 0"))

    assert lesson.status == "unsupported_instructional_method"
    assert lesson.method is None
    assert lesson.steps == []
