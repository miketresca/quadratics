import type {GameLessonId} from "@quadratics/types";

export type PublicGameLogStageSummary = {
  id: string;
  label: string;
  status: "ready" | "completed" | "locked";
  summary: string;
  inputs: string;
  outputs: string;
  futureWork?: string;
};

export type GameLesson = {
  id: GameLessonId;
  slug: string;
  title: string;
  subtitle: string;
  status: "unlocked" | "locked";
  kind: "pdf_placeholder" | "future_dynamic";
  pdfUrl?: string;
  orbAssetId: "lesson-orb" | "locked-orb";
  logSummary: PublicGameLogStageSummary[];
};

const volumeLogs: PublicGameLogStageSummary[] = [
  {
    id: "game_route",
    label: "GAME_ROUTE",
    status: "completed",
    summary: "Loads the game shell below the shared Quadratics header.",
    inputs: "Public static metadata and optional authenticated progress.",
    outputs: "Character select, arena, and lesson placeholder surfaces."
  },
  {
    id: "asset_manifest",
    label: "ASSET_MANIFEST",
    status: "completed",
    summary: "Normalizes prototype sprite, cursor, background, and orb assets.",
    inputs: "Local public assets plus source attribution.",
    outputs: "Typed manifest entries with replaceable runtime paths."
  },
  {
    id: "lesson_catalog",
    label: "LESSON_CATALOG",
    status: "completed",
    summary: "Defines the unlocked Volume with Whole-Number Cubes lesson and locked future lesson.",
    inputs: "Static Sprint 1 lesson definitions.",
    outputs: "One unlocked PDF placeholder and one future dynamic slot."
  },
  {
    id: "progress_state",
    label: "PROGRESS_STATE",
    status: "ready",
    summary: "Persists selected fighter and explicit lesson completion for signed-in users.",
    inputs: "Authenticated user, selected fighter, and lesson actions.",
    outputs: "User-scoped progress rows protected by the API and RLS."
  },
  {
    id: "pdf_placeholder",
    label: "PDF_PLACEHOLDER",
    status: "ready",
    summary: "Displays the provided worksheet PDF as the playable lesson placeholder.",
    inputs: "Public copied PDF from the task lesson file.",
    outputs: "Embedded worksheet with fallback open-PDF control."
  },
  {
    id: "future_pipeline_locked",
    label: "FUTURE_PIPELINE_LOCKED",
    status: "locked",
    summary: "Reserves the dynamic generated worksheet/video pipeline for a later sprint.",
    inputs: "Locked orb interaction only.",
    outputs: "Coming-soon message; no provider or generation request."
  }
];

export const GAME_LESSONS: GameLesson[] = [
  {
    id: "volume-cubes-lesson-1",
    slug: "volume-cubes",
    title: "Volume with Whole-Number Cubes",
    subtitle: "Playable PDF placeholder",
    status: "unlocked",
    kind: "pdf_placeholder",
    pdfUrl: "/game/lessons/volume-cubes/task-lesson.pdf",
    orbAssetId: "lesson-orb",
    logSummary: volumeLogs
  },
  {
    id: "dynamic-lesson-locked",
    slug: "dynamic-lesson",
    title: "Generated Lesson",
    subtitle: "Locked for the future dynamic pipeline",
    status: "locked",
    kind: "future_dynamic",
    orbAssetId: "locked-orb",
    logSummary: volumeLogs
  },
  {
    id: "dynamic-lesson-3-locked",
    slug: "future-challenge",
    title: "Future Challenge",
    subtitle: "Locked for a later worksheet",
    status: "locked",
    kind: "future_dynamic",
    orbAssetId: "locked-orb",
    logSummary: volumeLogs
  }
];

export function getGameLesson(lessonId: GameLessonId): GameLesson {
  const lesson = GAME_LESSONS.find((candidate) => candidate.id === lessonId);
  if (!lesson) {
    throw new Error(`Unknown game lesson: ${lessonId}`);
  }
  return lesson;
}
