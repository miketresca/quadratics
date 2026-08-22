import type {CurrentUser, GameLessonId} from "@quadratics/types";

import type {LaptopCostState, LaptopDisplayTab, LaptopPipelineState, MusicState} from "./game-laptop-panels";

export type LessonChoice = {
  id: GameLessonId;
  title: string;
  subtitle: string;
  locked: boolean;
  box: {x: number; y: number; width: number; height: number};
};

export type SceneTunableName = "laptop" | "clock" | "coffee" | "paper" | "map" | "phone" | "pen";
export type FocusMode = "room" | "paper" | "laptop" | "clock" | "map" | "phone";
export type InteractiveTarget = "paper" | "laptop" | "clock" | "map" | "phone" | null;

export type LaptopScreenApi = {
  setError: (message: string | null) => void;
  setCostState: (state: LaptopCostState) => void;
  setLoading: (loading: boolean) => void;
  setMusicState: (state: MusicState) => void;
  setPipelineState: (state: LaptopPipelineState) => void;
  setTab: (tab: LaptopDisplayTab) => void;
  updateUser: (user: CurrentUser | null) => void;
};

export type WorksheetRect = {height: number; width: number; x: number; y: number};

export type WorksheetSection = {
  completionMode?: string;
  handwritingActions?: WorksheetHandwritingAction[];
  id: string;
  narration?: WorksheetNarrationSection;
  pageId?: string;
  regionId?: string;
  summary?: string;
  title: string;
};

export type WorksheetFillTarget = {
  expectedText?: string;
  id: string;
  inputMode?: "student_text" | "read_only";
  pageId?: string;
  questionId?: string;
  rect: WorksheetRect;
  sectionId?: string;
};

export type WorksheetHandwritingAction = {
  endSeconds?: number;
  fillTargetId?: string;
  id: string;
  sectionId?: string;
  startSeconds?: number;
  text?: string;
};

export type WorksheetNarrationSection = {
  audioUrl?: string | null;
  durationSeconds?: number;
  sectionId?: string;
  speechText?: string;
};

export type InteractiveWorksheetBundle = {
  fillTargets?: WorksheetFillTarget[];
  pages?: Array<{id: string; pageNumber?: number}>;
  sections?: WorksheetSection[];
};

export type PhoneScreenMode = "off" | "quote" | "reward" | "rickroll";

export type VisitorLocation = {
  city: string | null;
  country: string | null;
  latitude: number | null;
  longitude: number | null;
  region: string | null;
};

export type VisitorMapPin = {
  current?: boolean;
  label: string;
  latitude: number;
  longitude: number;
};

export type WorldMapGeoJson = {
  features: Array<{
    geometry: {
      coordinates: unknown;
      type: "Polygon" | "MultiPolygon";
    } | null;
    type: "Feature";
  }>;
  type: "FeatureCollection";
};
