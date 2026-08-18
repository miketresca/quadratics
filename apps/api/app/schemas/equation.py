from pydantic import Field

from app.schemas.common import ApiModel


class SolveEquationRequest(ApiModel):
    equation: str = Field(min_length=1, max_length=200)
    instructor_id: str | None = None


class MathValue(ApiModel):
    expression: str
    latex: str


class QuadraticCoefficients(ApiModel):
    a: MathValue
    b: MathValue
    c: MathValue
