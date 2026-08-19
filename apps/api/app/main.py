from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.routes import equations, generations, health, instructors, provider_keys, users
from app.core.config import get_settings


def create_app() -> FastAPI:
    settings = get_settings()
    app = FastAPI(title="Quadratics API")

    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.allowed_origins,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    app.include_router(health.router)
    app.include_router(users.router, prefix="/api/v1")
    app.include_router(provider_keys.router, prefix="/api/v1")
    app.include_router(instructors.router, prefix="/api/v1")
    app.include_router(generations.router, prefix="/api/v1")
    app.include_router(equations.router, prefix="/api/v1")
    return app


app = create_app()
