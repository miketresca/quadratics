from __future__ import annotations

from enum import StrEnum

from sympy import factor_list

from app.services.math.solver import QuadraticSolution


class SolutionMethod(StrEnum):
    FACTORING = "factoring"
    SQUARE_ROOT = "square_root"
    COMPLETING_THE_SQUARE = "completing_the_square"
    QUADRATIC_FORMULA = "quadratic_formula"


def select_instructional_method(solution: QuadraticSolution) -> SolutionMethod | None:
    coefficient, factors = factor_list(solution.quadratic.normalized_expression)
    if coefficient == 0 or len(factors) != 2:
        return None
    x = solution.quadratic.polynomial.gens[0]
    clean_linear_factors = all(
        power == 1 and factor.as_poly(x).degree() == 1 for factor, power in factors
    )
    if clean_linear_factors:
        if all(root.is_Rational for root in solution.roots):
            return SolutionMethod.FACTORING
    return None
