from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException

from app.api.dependencies.auth import get_current_user
from app.core.security import AuthenticatedUser
from app.schemas.equation import SolveEquationRequest
from app.schemas.lesson import LessonResponse
from app.services.lessons.builder import build_lesson
from app.services.math.parser import EquationParseError, parse_equation
from app.services.math.solver import solve_quadratic
from app.services.math.validator import QuadraticValidationError, validate_quadratic

router = APIRouter(prefix="/equations")


@router.post("/solve", response_model=LessonResponse)
async def solve_equation(
    request: SolveEquationRequest,
    _current_user: Annotated[AuthenticatedUser, Depends(get_current_user)],
) -> LessonResponse:
    try:
        parsed = parse_equation(request.equation)
        quadratic = validate_quadratic(parsed)
        solution = solve_quadratic(quadratic)
    except (EquationParseError, QuadraticValidationError) as exc:
        raise HTTPException(
            status_code=422,
            detail=str(exc),
        ) from exc
    return build_lesson(solution)
