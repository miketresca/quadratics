from __future__ import annotations

from dataclasses import dataclass

from sympy import Poly, expand
from sympy.core.expr import Expr
from sympy.polys.polyerrors import PolynomialError

from app.services.math.parser import ParsedEquation


class QuadraticValidationError(ValueError):
    pass


@dataclass(frozen=True)
class Quadratic:
    original_equation: str
    normalized_expression: Expr
    normalized_equation: str
    polynomial: Poly
    a: Expr
    b: Expr
    c: Expr


def validate_quadratic(parsed: ParsedEquation) -> Quadratic:
    expression = expand(parsed.equation.lhs - parsed.equation.rhs)
    symbols = expression.free_symbols
    if symbols and symbols != {parsed.variable}:
        raise QuadraticValidationError("Only variable x is supported")
    try:
        polynomial = Poly(expression, parsed.variable)
    except PolynomialError as exc:
        raise QuadraticValidationError("Equation must be polynomial in x") from exc
    if polynomial.degree() != 2:
        raise QuadraticValidationError("Equation must be quadratic")
    a, b, c = polynomial.all_coeffs()
    if a == 0:
        raise QuadraticValidationError("Quadratic coefficient cannot be zero")
    normalized_equation = f"{str(expression)} = 0"
    return Quadratic(
        original_equation=parsed.original,
        normalized_expression=expression,
        normalized_equation=normalized_equation,
        polynomial=polynomial,
        a=a,
        b=b,
        c=c,
    )
