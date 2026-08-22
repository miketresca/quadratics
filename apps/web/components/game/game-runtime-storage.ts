import type {GameWorksheetPlaybackProgress} from "@quadratics/types";

import type {MusicState} from "./game-laptop-panels";

const POMODORO_STORAGE_KEY = "quadratics.game.pomodoro.v1";
const MUSIC_STORAGE_KEY = "quadratics.game.music.v1";
const WORKSHEET_PLAYBACK_STORAGE_PREFIX = "quadratics.game.worksheet-playback.v1";
const PHONE_REWARD_STORAGE_PREFIX = "quadratics.game.phone-reward.v1";

export type WorksheetPlaybackState = {
  activeSectionId: string | null;
  activeSectionStartedAt: number | null;
  completedSectionIds: string[];
  currentPageId: string | null;
  lessonCompletedAt: number | null;
};

export type PomodoroState = {
  endsAt: number | null;
  minutes: number;
};

export const DEFAULT_WORKSHEET_PLAYBACK: WorksheetPlaybackState = {
  activeSectionId: null,
  activeSectionStartedAt: null,
  completedSectionIds: [],
  currentPageId: null,
  lessonCompletedAt: null
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
      activeSectionId: typeof parsed.activeSectionId === "string" ? parsed.activeSectionId : null,
      activeSectionStartedAt: typeof parsed.activeSectionStartedAt === "number" ? parsed.activeSectionStartedAt : null,
      completedSectionIds: Array.isArray(parsed.completedSectionIds) ? parsed.completedSectionIds.filter((value): value is string => typeof value === "string") : [],
      currentPageId: typeof parsed.currentPageId === "string" ? parsed.currentPageId : null,
      lessonCompletedAt: typeof parsed.lessonCompletedAt === "number" ? parsed.lessonCompletedAt : null
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
    completedSectionIds: state.completedSectionIds,
    currentPageId: state.currentPageId,
    lessonCompletedAt: state.lessonCompletedAt
  };
}

export function worksheetPlaybackFromApi(progress: GameWorksheetPlaybackProgress | null | undefined): WorksheetPlaybackState {
  if (!progress) {
    return DEFAULT_WORKSHEET_PLAYBACK;
  }
  return {
    activeSectionId: null,
    activeSectionStartedAt: null,
    completedSectionIds: progress.completedSectionIds ?? [],
    currentPageId: progress.currentPageId ?? null,
    lessonCompletedAt: progress.lessonCompletedAt ?? null
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
