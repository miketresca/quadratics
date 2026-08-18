from __future__ import annotations

from sympy import Eq, factor, factor_list, latex, solve
from sympy.core.expr import Expr

from app.schemas.equation import MathValue, QuadraticCoefficients
from app.schemas.lesson import LessonResponse, MathLine, TeachingStep
from app.services.math.solver import QuadraticSolution
from app.services.math.strategy import SolutionMethod, select_instructional_method


def build_lesson(solution: QuadraticSolution) -> LessonResponse:
    method = select_instructional_method(solution)
    coefficients = QuadraticCoefficients(
        a=_math_value(solution.quadratic.a),
        b=_math_value(solution.quadratic.b),
        c=_math_value(solution.quadratic.c),
    )
    roots = [_math_value(root) for root in solution.roots]

    if method is not SolutionMethod.FACTORING:
        return LessonResponse(
            status="unsupported_instructional_method",
            original_equation=solution.quadratic.original_equation,
            normalized_equation=solution.quadratic.normalized_equation,
            method=None,
            coefficients=coefficients,
            solutions=roots,
            steps=[],
            unsupported_reason=(
                "This quadratic is valid, but v0 only builds lessons for clean "
                "rational factoring."
            ),
        )

    return LessonResponse(
        status="completed",
        original_equation=solution.quadratic.original_equation,
        normalized_equation=solution.quadratic.normalized_equation,
        method=SolutionMethod.FACTORING.value,
        coefficients=coefficients,
        solutions=roots,
        steps=_build_factoring_steps(solution),
    )


def _build_factoring_steps(solution: QuadraticSolution) -> list[TeachingStep]:
    x = solution.quadratic.polynomial.gens[0]
    factored = factor(solution.quadratic.normalized_expression)
    _, factors = factor_list(solution.quadratic.normalized_expression)
    linear_factors = [factor_expr for factor_expr, _ in factors]

    factor_lines = [
        _equation_line("standard_form", solution.quadratic.normalized_expression),
        _equation_line("factored_form", factored),
    ]

    solve_lines: list[MathLine] = []
    for index, factor_expr in enumerate(linear_factors):
        root = solve(Eq(factor_expr, 0), x)[0]
        prefix = "first" if index == 0 else "second"
        solve_lines.append(_equation_line(f"{prefix}_factor", factor_expr))
        solve_lines.append(_assignment_line(f"{prefix}_solution", x, root))

    final_expression = f"x = {', '.join(str(root) for root in solution.roots)}"
    final_latex = "x = " + ", ".join(latex(root) for root in solution.roots)

    return [
        TeachingStep(
            id="factor",
            title="Factor the quadratic",
            step_type="factor",
            math_lines=factor_lines,
        ),
        TeachingStep(
            id="solve_factors",
            title="Solve each factor",
            step_type="solve_factors",
            math_lines=solve_lines,
        ),
        TeachingStep(
            id="final_answer",
            title="State the final answer",
            step_type="final_answer",
            math_lines=[MathLine(id="solutions", expression=final_expression, latex=final_latex)],
        ),
    ]


def _math_value(value: Expr) -> MathValue:
    return MathValue(expression=str(value), latex=latex(value))


def _equation_line(line_id: str, expression: Expr) -> MathLine:
    return MathLine(
        expression=f"{str(expression)} = 0",
        id=line_id,
        latex=f"{latex(expression)} = 0",
    )


def _assignment_line(line_id: str, variable: Expr, value: Expr) -> MathLine:
    return MathLine(
        id=line_id,
        expression=f"{variable} = {value}",
        latex=f"{latex(variable)} = {latex(value)}",
    )
