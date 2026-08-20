export type GameFighterId = "captain-falcon" | "jigglypuff" | "luigi";
export type GameLessonId = "volume-cubes-lesson-1" | "dynamic-lesson-locked";
export type GameLessonProgressStatus = "started" | "completed";
export type GameProgressAction = "select_fighter" | "start_lesson" | "complete_lesson";

export interface GameLessonProgress {
  lessonId: GameLessonId;
  status: GameLessonProgressStatus;
  startedAt?: string | null;
  completedAt?: string | null;
}

export interface GameProgress {
  selectedFighterId?: GameFighterId | null;
  lessons: GameLessonProgress[];
}

export interface GameProgressUpdateRequest {
  action: GameProgressAction;
  selectedFighterId?: GameFighterId | null;
  lessonId?: GameLessonId | null;
}
