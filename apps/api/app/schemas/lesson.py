from typing import Literal

from app.schemas.common import ApiModel
from app.schemas.equation import MathValue, QuadraticCoefficients

SolutionMethod = Literal["factoring", "square_root", "completing_the_square", "quadratic_formula"]
LessonStatus = Literal["completed", "unsupported_instructional_method"]


class MathLine(ApiModel):
    id: str
    expression: str
    latex: str


class TeachingStep(ApiModel):
    id: str
    title: str
    step_type: str
    math_lines: list[MathLine]


class LessonResponse(ApiModel):
    status: LessonStatus
    original_equation: str
    normalized_equation: str
    method: SolutionMethod | None
    coefficients: QuadraticCoefficients
    solutions: list[MathValue]
    steps: list[TeachingStep]
    unsupported_reason: str | None = None
