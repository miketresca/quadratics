from __future__ import annotations

from dataclasses import dataclass

from sympy import solve
from sympy.core.expr import Expr

from app.services.math.validator import Quadratic


@dataclass(frozen=True)
class QuadraticSolution:
    quadratic: Quadratic
    roots: tuple[Expr, ...]


def solve_quadratic(quadratic: Quadratic) -> QuadraticSolution:
    roots = tuple(solve(quadratic.normalized_expression, quadratic.polynomial.gens[0]))
    return QuadraticSolution(quadratic=quadratic, roots=roots)
