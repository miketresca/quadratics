from app.schemas.lesson_context import RealWorldContext
from app.services.context.base import RealWorldContextProvider, RealWorldContextRequest


class DevelopmentRealWorldContextProvider(RealWorldContextProvider):
    async def generate(self, request: RealWorldContextRequest) -> RealWorldContext:
        lesson = request.lesson
        coefficients = lesson["coefficients"]
        solutions = ", ".join(solution["expression"] for solution in lesson["solutions"])
        equation = lesson["normalizedEquation"]
        a_value = coefficients["a"]["expression"]

        direction = "upward" if not str(a_value).startswith("-") else "downward"
        return RealWorldContext(
            status="completed",
            title="Fundraiser break-even days",
            scenario=(
                f"Use {equation} as a simple model for a class fundraiser, where x is "
                "weeks from launch day and the output is profit in dollars. The graph "
                f"opens {direction}. The roots, {solutions}, are the weeks when the "
                "fundraiser breaks even because the profit is zero."
            ),
            takeaway=(
                "The roots show the break-even points, and the vertex shows the lowest "
                "or highest profit between them."
            ),
            provider_metadata={"provider": "development"},
        )
