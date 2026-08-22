import type {GameWorksheetPlaybackProgress} from "@quadratics/types";

import type {MusicState} from "./game-laptop-panels";

const POMODORO_STORAGE_KEY = "quadratics.game.pomodoro.v1";
const MUSIC_STORAGE_KEY = "quadratics.game.music.v1";
const WORKSHEET_PLAYBACK_STORAGE_PREFIX = "quadratics.game.worksheet-playback.v1";
const PHONE_REWARD_STORAGE_PREFIX = "quadratics.game.phone-reward.v1";

export type WorksheetPlaybackState = {
  activeFillTargetId: string | null;
  answerResults: Record<string, WorksheetAnswerResult>;
  answers: Record<string, string>;
  activeSectionId: string | null;
  activeSectionStartedAt: number | null;
  completedSectionIds: string[];
  currentPageId: string | null;
  lessonCompletedAt: number | null;
  submittedAt: number | null;
};

export type WorksheetAnswerResult = {
  correct: boolean;
  expectedText?: string | null;
  explanation?: string | null;
};

export type PomodoroState = {
  endsAt: number | null;
  minutes: number;
};

export const DEFAULT_WORKSHEET_PLAYBACK: WorksheetPlaybackState = {
  activeFillTargetId: null,
  answerResults: {},
  answers: {},
  activeSectionId: null,
  activeSectionStartedAt: null,
  completedSectionIds: [],
  currentPageId: null,
  lessonCompletedAt: null,
  submittedAt: null
};

export function readPomodoroState(): PomodoroState {
  if (typeof window === "undefined") {
    return {endsAt: null, minutes: 25};
  }
  try {
    return {...{endsAt: null, minutes: 25}, ...JSON.parse(window.localStorage.getItem(POMODORO_STORAGE_KEY) ?? "{}")};
  } catch {
    return {endsAt: null, minutes: 25};
  }
}

export function writePomodoroState(state: PomodoroState) {
  if (typeof window === "undefined") {
    return;
  }
  window.localStorage.setItem(POMODORO_STORAGE_KEY, JSON.stringify(state));
}

export function clampMusicVolume(volume: number) {
  return Math.max(0, Math.min(100, Math.round(volume)));
}

export function readMusicState(): MusicState {
  if (typeof window === "undefined") {
    return {muted: false, selectedMusicId: "lofi", volume: 35};
  }
  try {
    const parsed = JSON.parse(window.localStorage.getItem(MUSIC_STORAGE_KEY) ?? "{}") as Partial<MusicState>;
    return {
      muted: Boolean(parsed.muted),
      selectedMusicId: parsed.selectedMusicId === "techno" || parsed.selectedMusicId === "classical" ? parsed.selectedMusicId : "lofi",
      volume: clampMusicVolume(typeof parsed.volume === "number" ? parsed.volume : 35)
    };
  } catch {
    return {muted: false, selectedMusicId: "lofi", volume: 35};
  }
}

export function writeMusicState(state: MusicState) {
  if (typeof window === "undefined") {
    return;
  }
  window.localStorage.setItem(MUSIC_STORAGE_KEY, JSON.stringify(state));
}

export function readWorksheetPlaybackState(runId: string): WorksheetPlaybackState {
  if (typeof window === "undefined") {
    return DEFAULT_WORKSHEET_PLAYBACK;
  }
  try {
    const parsed = JSON.parse(window.localStorage.getItem(worksheetPlaybackStorageKey(runId)) ?? "{}") as Partial<WorksheetPlaybackState>;
    return {
      activeFillTargetId: typeof parsed.activeFillTargetId === "string" ? parsed.activeFillTargetId : null,
      answerResults: isAnswerResultsRecord(parsed.answerResults) ? parsed.answerResults : {},
      answers: isStringRecord(parsed.answers) ? parsed.answers : {},
      activeSectionId: typeof parsed.activeSectionId === "string" ? parsed.activeSectionId : null,
      activeSectionStartedAt: typeof parsed.activeSectionStartedAt === "number" ? parsed.activeSectionStartedAt : null,
      completedSectionIds: Array.isArray(parsed.completedSectionIds) ? parsed.completedSectionIds.filter((value): value is string => typeof value === "string") : [],
      currentPageId: typeof parsed.currentPageId === "string" ? parsed.currentPageId : null,
      lessonCompletedAt: typeof parsed.lessonCompletedAt === "number" ? parsed.lessonCompletedAt : null,
      submittedAt: typeof parsed.submittedAt === "number" ? parsed.submittedAt : null
    };
  } catch {
    return DEFAULT_WORKSHEET_PLAYBACK;
  }
}

export function writeWorksheetPlaybackState(runId: string, state: WorksheetPlaybackState) {
  if (typeof window === "undefined") {
    return;
  }
  window.localStorage.setItem(worksheetPlaybackStorageKey(runId), JSON.stringify(state));
}

export function toApiWorksheetPlayback(state: WorksheetPlaybackState): GameWorksheetPlaybackProgress {
  return {
    activeFillTargetId: state.activeFillTargetId,
    answerResults: state.answerResults,
    answers: state.answers,
    completedSectionIds: state.completedSectionIds,
    currentPageId: state.currentPageId,
    lessonCompletedAt: state.lessonCompletedAt,
    submittedAt: state.submittedAt
  };
}

export function worksheetPlaybackFromApi(progress: GameWorksheetPlaybackProgress | null | undefined): WorksheetPlaybackState {
  if (!progress) {
    return DEFAULT_WORKSHEET_PLAYBACK;
  }
  return {
    activeFillTargetId: progress.activeFillTargetId ?? null,
    answerResults: isAnswerResultsRecord(progress.answerResults) ? progress.answerResults : {},
    answers: isStringRecord(progress.answers) ? progress.answers : {},
    activeSectionId: null,
    activeSectionStartedAt: null,
    completedSectionIds: progress.completedSectionIds ?? [],
    currentPageId: progress.currentPageId ?? null,
    lessonCompletedAt: progress.lessonCompletedAt ?? null,
    submittedAt: progress.submittedAt ?? null
  };
}

export function readPhoneRewardState(userId: string) {
  if (typeof window === "undefined") {
    return false;
  }
  return window.localStorage.getItem(phoneRewardStorageKey(userId)) === "pending";
}

export function writePhoneRewardState(userId: string, pending: boolean) {
  if (typeof window === "undefined") {
    return;
  }
  if (pending) {
    window.localStorage.setItem(phoneRewardStorageKey(userId), "pending");
  } else {
    window.localStorage.removeItem(phoneRewardStorageKey(userId));
  }
}

export function formatPomodoroClock(ms: number) {
  const totalSeconds = Math.max(0, Math.ceil(ms / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

function worksheetPlaybackStorageKey(runId: string) {
  return `${WORKSHEET_PLAYBACK_STORAGE_PREFIX}.${runId}`;
}

function phoneRewardStorageKey(userId: string) {
  return `${PHONE_REWARD_STORAGE_PREFIX}.${userId}`;
}

function isStringRecord(value: unknown): value is Record<string, string> {
  return (
    typeof value === "object" &&
    value !== null &&
    !Array.isArray(value) &&
    Object.values(value).every((entry) => typeof entry === "string")
  );
}

function isAnswerResultsRecord(value: unknown): value is Record<string, WorksheetAnswerResult> {
  return (
    typeof value === "object" &&
    value !== null &&
    !Array.isArray(value) &&
    Object.values(value).every(
      (entry) =>
        typeof entry === "object" &&
        entry !== null &&
        !Array.isArray(entry) &&
        typeof (entry as {correct?: unknown}).correct === "boolean"
    )
  );
}
