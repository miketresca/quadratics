from __future__ import annotations

import re
from dataclasses import dataclass

from sympy import Eq, Integer, Rational, Symbol
from sympy.core.expr import Expr
from sympy.parsing.sympy_parser import (
    convert_xor,
    parse_expr,
    rationalize,
    standard_transformations,
)

MAX_EQUATION_LENGTH = 200
MAX_EXPONENT = 8
MAX_TERM_SEPARATORS = 24
ALLOWED_PATTERN = re.compile(r"^[0-9xX\s+\-*/^().=]+$")
EXPONENT_PATTERN = re.compile(r"(?:\^|\*\*)\s*(\d+)")


class EquationParseError(ValueError):
    pass


@dataclass(frozen=True)
class ParsedEquation:
    original: str
    equation: Eq
    variable: Symbol


def parse_equation(equation_input: str) -> ParsedEquation:
    raw = equation_input.strip()
    if not raw:
        raise EquationParseError("Equation is required")
    if len(raw) > MAX_EQUATION_LENGTH:
        raise EquationParseError("Equation is too long")
    if raw.count("=") != 1:
        raise EquationParseError("Equation must contain exactly one equals sign")
    if not ALLOWED_PATTERN.match(raw):
        raise EquationParseError("Equation contains unsupported characters")
    if raw.count("+") + raw.count("-") > MAX_TERM_SEPARATORS:
        raise EquationParseError("Equation has too many terms")

    normalized = raw.replace("X", "x")
    for exponent in EXPONENT_PATTERN.findall(normalized):
        if int(exponent) > MAX_EXPONENT:
            raise EquationParseError("Equation exponent is too large")

    left_raw, right_raw = normalized.split("=", maxsplit=1)
    x = Symbol("x")
    left = _safe_parse_side(left_raw, x)
    right = _safe_parse_side(right_raw, x)
    return ParsedEquation(original=raw, equation=Eq(left, right), variable=x)


def _safe_parse_side(raw: str, x: Symbol) -> Expr:
    if not raw.strip():
        raise EquationParseError("Equation side is empty")
    transformations = standard_transformations + (convert_xor, rationalize)
    try:
        return parse_expr(
            raw,
            local_dict={"x": x},
            global_dict={"Integer": Integer, "Rational": Rational, "__builtins__": {}},
            transformations=transformations,
            evaluate=True,
        )
    except Exception as exc:  # SymPy raises several parse-specific exceptions.
        raise EquationParseError("Equation is malformed") from exc
