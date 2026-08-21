export type GameFighterId =
  | "mario"
  | "donkey-kong"
  | "link"
  | "samus"
  | "captain-falcon"
  | "ness"
  | "yoshi"
  | "kirby"
  | "fox"
  | "pikachu"
  | "luigi"
  | "jigglypuff";
export type GameLessonId = "volume-cubes-lesson-1" | "dynamic-lesson-locked";
export type GameLessonProgressStatus = "started" | "completed";
export type GameProgressAction =
  | "claim_easter_egg"
  | "clear_phone_reward"
  | "complete_lesson"
  | "set_phone_reward"
  | "start_lesson"
  | "update_lesson_playback"
  | "select_fighter";

export interface GameWorksheetPlaybackProgress {
  completedSectionIds: string[];
  currentPageId?: string | null;
  lessonCompletedAt?: number | null;
}

export interface GameEasterEggProgress {
  discoveredIds: string[];
  total: number;
}

export interface GameLessonProgressMetadata {
  easterEggs?: GameEasterEggProgress;
  phoneRewardPending?: boolean;
  worksheetPlayback?: GameWorksheetPlaybackProgress;
}

export interface GameLessonProgress {
  lessonId: GameLessonId;
  status: GameLessonProgressStatus;
  startedAt?: string | null;
  completedAt?: string | null;
  metadata?: GameLessonProgressMetadata;
}

export interface GameProgress {
  selectedFighterId?: GameFighterId | null;
  lessons: GameLessonProgress[];
}

export interface GameProgressUpdateRequest {
  action: GameProgressAction;
  easterEggId?: string | null;
  selectedFighterId?: GameFighterId | null;
  lessonId?: GameLessonId | null;
  worksheetPlayback?: GameWorksheetPlaybackProgress | null;
}
