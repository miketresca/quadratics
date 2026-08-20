from __future__ import annotations

from dataclasses import dataclass


ALLOWED_FIGHTER_IDS = frozenset({"captain-falcon", "jigglypuff", "luigi"})


@dataclass(frozen=True)
class GameLessonDefinition:
    id: str
    locked: bool


LESSONS = {
    "volume-cubes-lesson-1": GameLessonDefinition(id="volume-cubes-lesson-1", locked=False),
    "dynamic-lesson-locked": GameLessonDefinition(id="dynamic-lesson-locked", locked=True),
}


def is_allowed_fighter(fighter_id: str) -> bool:
    return fighter_id in ALLOWED_FIGHTER_IDS


def get_lesson(lesson_id: str) -> GameLessonDefinition | None:
    return LESSONS.get(lesson_id)
