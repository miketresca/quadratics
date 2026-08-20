from typing import Literal

from app.schemas.common import ApiModel

GameFighterId = Literal[
    "mario",
    "donkey-kong",
    "link",
    "samus",
    "captain-falcon",
    "ness",
    "yoshi",
    "kirby",
    "fox",
    "pikachu",
    "luigi",
    "jigglypuff",
]
GameLessonId = Literal["volume-cubes-lesson-1", "dynamic-lesson-locked"]
GameLessonProgressStatus = Literal["started", "completed"]
GameProgressAction = Literal["select_fighter", "start_lesson", "complete_lesson"]


class GameLessonProgress(ApiModel):
    lesson_id: GameLessonId
    status: GameLessonProgressStatus
    started_at: str | None = None
    completed_at: str | None = None


class GameProgress(ApiModel):
    selected_fighter_id: GameFighterId | None = None
    lessons: list[GameLessonProgress] = []


class GameProgressUpdateRequest(ApiModel):
    action: GameProgressAction
    selected_fighter_id: GameFighterId | None = None
    lesson_id: GameLessonId | None = None
