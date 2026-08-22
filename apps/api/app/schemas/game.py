from typing import Literal

from pydantic import Field

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
GameProgressAction = Literal[
    "claim_easter_egg",
    "clear_phone_reward",
    "complete_lesson",
    "set_phone_reward",
    "start_lesson",
    "update_lesson_playback",
    "select_fighter",
]


class GameWorksheetPlaybackProgress(ApiModel):
    active_fill_target_id: str | None = None
    answer_results: dict[str, dict[str, str | bool | None]] = Field(default_factory=dict)
    answers: dict[str, str] = Field(default_factory=dict)
    completed_section_ids: list[str] = Field(default_factory=list)
    current_page_id: str | None = None
    lesson_completed_at: int | None = None
    submitted_at: int | None = None


class GameEasterEggProgress(ApiModel):
    discovered_ids: list[str] = Field(default_factory=list)
    total: int = 1


class GameLessonProgressMetadata(ApiModel):
    easter_eggs: GameEasterEggProgress | None = None
    phone_reward_pending: bool | None = None
    worksheet_playback: GameWorksheetPlaybackProgress | None = None


class GameLessonProgress(ApiModel):
    lesson_id: GameLessonId
    status: GameLessonProgressStatus
    started_at: str | None = None
    completed_at: str | None = None
    metadata: GameLessonProgressMetadata | None = None


class GameProgress(ApiModel):
    selected_fighter_id: GameFighterId | None = None
    lessons: list[GameLessonProgress] = Field(default_factory=list)


class GameProgressUpdateRequest(ApiModel):
    action: GameProgressAction
    easter_egg_id: str | None = None
    selected_fighter_id: GameFighterId | None = None
    lesson_id: GameLessonId | None = None
    worksheet_playback: GameWorksheetPlaybackProgress | None = None
