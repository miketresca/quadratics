"use client";

import type {CurrentUser, GameLessonId, GameProgress, Instructor} from "@quadratics/types";
import {useEffect, useRef, useState, type FormEvent} from "react";
import type {Group, Mesh, Object3D, PerspectiveCamera, Scene, Texture, Vector3, WebGLRenderer} from "three";
import type {CSS3DRenderer} from "three/examples/jsm/renderers/CSS3DRenderer.js";

import {
  approveGameLessonArtifact,
  createGameLessonRun,
  getGameUsageEvents,
  getGameUsageSummary,
  listInstructors,
  runGameLessonStage,
  type GameLessonArtifact,
  type GameLessonStage,
  type GameWorksheetRunSnapshot
} from "@/lib/api";
import {getGameProgress, resetGameProgress, updateGameProgress} from "@/lib/game/progress-client";
import {createClient} from "@/lib/supabase/client";

import {
  LaptopFocusPanel,
  MUSIC_OPTIONS,
  formatQuantity,
  formatUsd,
  musicEmbedUrl,
  type LaptopCostState,
  type LaptopPipelineState,
  type LaptopTab,
  type MusicOptionId,
  type MusicState
} from "./game-laptop-panels";
import {
  GAME_LESSON_DEFAULT_INSTRUCTOR_LABEL,
  GAME_LESSON_STAGES,
  artifactForStage,
  artifactPreviewRows,
  artifactPreviewText,
  gameStageDetails,
  gameStageMetaLine,
  isGameLessonPublished,
  pipelineDependencyMessage,
  shortRunId,
  stagePalette,
  statusColor
} from "./game-pipeline-utils";
import {
  DEFAULT_WORKSHEET_PLAYBACK,
  clampMusicVolume,
  formatPomodoroClock,
  readMusicState,
  readPhoneRewardState,
  readPomodoroState,
  readWorksheetPlaybackState,
  toApiWorksheetPlayback,
  worksheetPlaybackFromApi,
  writeMusicState,
  writePhoneRewardState,
  writePomodoroState,
  writeWorksheetPlaybackState,
  type PomodoroState,
  type WorksheetPlaybackState
} from "./game-runtime-storage";

type LessonChoice = {
  id: GameLessonId;
  title: string;
  subtitle: string;
  locked: boolean;
  box: {x: number; y: number; width: number; height: number};
};

type SceneTunableName = "laptop" | "clock" | "coffee" | "paper" | "map" | "phone" | "pen";
type FocusMode = "room" | "paper" | "laptop" | "clock" | "map" | "phone";
type InteractiveTarget = "paper" | "laptop" | "clock" | "map" | "phone" | null;
type LaptopScreenApi = {
  setError: (message: string | null) => void;
  setCostState: (state: LaptopCostState) => void;
  setLoading: (loading: boolean) => void;
  setMusicState: (state: MusicState) => void;
  setPipelineState: (state: LaptopPipelineState) => void;
  setTab: (tab: LaptopTab) => void;
  updateUser: (user: CurrentUser | null) => void;
};
type WorksheetRect = {height: number; width: number; x: number; y: number};
type WorksheetSection = {
  completionMode?: string;
  handwritingActions?: WorksheetHandwritingAction[];
  id: string;
  narration?: WorksheetNarrationSection;
  pageId?: string;
  regionId?: string;
  summary?: string;
  title: string;
};
type WorksheetFillTarget = {
  expectedText?: string;
  id: string;
  pageId?: string;
  questionId?: string;
  rect: WorksheetRect;
  sectionId?: string;
};
type WorksheetHandwritingAction = {
  endSeconds?: number;
  fillTargetId?: string;
  id: string;
  sectionId?: string;
  startSeconds?: number;
  text?: string;
};
type WorksheetNarrationSection = {
  audioUrl?: string | null;
  durationSeconds?: number;
  sectionId?: string;
  speechText?: string;
};
type InteractiveWorksheetBundle = {
  fillTargets?: WorksheetFillTarget[];
  pages?: Array<{id: string; pageNumber?: number}>;
  sections?: WorksheetSection[];
};
type PhoneScreenMode = "off" | "quote" | "reward" | "rickroll";

type VisitorLocation = {
  city: string | null;
  country: string | null;
  latitude: number | null;
  longitude: number | null;
  region: string | null;
};

type VisitorMapPin = {
  current?: boolean;
  label: string;
  latitude: number;
  longitude: number;
};

type WorldMapGeoJson = {
  features: Array<{
    geometry: {
      coordinates: unknown;
      type: "Polygon" | "MultiPolygon";
    } | null;
    type: "Feature";
  }>;
  type: "FeatureCollection";
};

const PAPER_WIDTH = 2.68;
const PAPER_HEIGHT = 3.9;
const DESK_SURFACE_Y = 1.08;
const PAPER_Y = DESK_SURFACE_Y + 0.045;
const DESK_RIG_Z = -1.18;
const SEATED_CAMERA_Z = 5.45 + DESK_RIG_Z;
const WORKSHEET_CANVAS_WIDTH = 1200;
const WORKSHEET_CANVAS_HEIGHT = 1600;
const WORKSHEET_NEXT_PAGE_RECT = {height: 74, width: 312, x: 792, y: 1402};
const WORKSHEET_COMPLETE_RECT = {height: 74, width: 348, x: 756, y: 1402};
const ALARM_SOUND_URL = "/game/assets/audio/alarm_sound.wav";
const PHONE_VIBRATION_SOUND_URL = "/game/assets/audio/mobile-phone-vibration.mp3";
const ROOM = {
  width: 10.6,
  depth: 9.4,
  height: 5.8,
  floorY: 0,
  backWindowZ: -4.32,
  leftWindowX: -5.3,
  rightWallX: 5.3,
  deskZ: 0.04
} as const;
const LESSON_CHOICES: LessonChoice[] = [
  {
    id: "volume-cubes-lesson-1",
    title: "Lesson 1: Volume With Cubes",
    subtitle: "Open the guided-notes worksheet",
    locked: false,
    box: {x: 118, y: 385, width: 964, height: 188}
  },
  {
    id: "dynamic-lesson-locked",
    title: "Lesson 2: Generated Worksheet",
    subtitle: "Locked until the worksheet pipeline exists",
    locked: true,
    box: {x: 118, y: 625, width: 964, height: 188}
  }
];
const VISITOR_HISTORY_PINS: VisitorMapPin[] = [
  {label: "United States", latitude: 39.8, longitude: -98.6},
  {label: "Argentina", latitude: -38.4, longitude: -63.6},
  {label: "United Kingdom", latitude: 55.4, longitude: -3.4},
  {label: "Germany", latitude: 51.2, longitude: 10.4},
  {label: "Brazil", latitude: -14.2, longitude: -51.9},
  {label: "Japan", latitude: 36.2, longitude: 138.3},
  {label: "Australia", latitude: -25.3, longitude: 133.8}
];
const PHONE_FOCUS_QUOTES = [
  {author: "Marcus Aurelius", text: "The impediment to action advances action."},
  {author: "Seneca", text: "No great thing is created suddenly."},
  {author: "Epictetus", text: "If you seek tranquility, do less, better."},
  {author: "David Goggins", text: "Be more than motivated. Be more than driven."},
  {author: "James Clear", text: "You do not rise to your goals. You fall to your systems."},
  {author: "Cal Newport", text: "Clarity about what matters provides clarity about what does not."}
];
const GAME_LESSON_TEMPLATE_ID = "volume-cubes-lesson-1";

export function GameShell({
  initialLoginError,
  initialUser
}: {
  initialLoginError: string | null;
  initialUser: CurrentUser | null;
}) {
  const mountRef = useRef<HTMLDivElement | null>(null);
  const startedRef = useRef(false);
  const worksheetFocusedRef = useRef(false);
  const focusModeRef = useRef<FocusMode>("room");
  const focusModeSetterRef = useRef<((mode: FocusMode) => void) | null>(null);
  const pointerLockedRef = useRef(false);
  const laptopScreenRef = useRef<LaptopScreenApi | null>(null);
  const userRef = useRef<CurrentUser | null>(initialUser);
  const pomodoroRef = useRef<PomodoroState>(initialUser ? readPomodoroState() : {endsAt: null, minutes: 25});
  const alarmAudioRef = useRef<HTMLAudioElement | null>(null);
  const sectionAudioRef = useRef<HTMLAudioElement | null>(null);
  const sectionCompletionTimerRef = useRef<number | null>(null);
  const sectionSpeechUtteranceRef = useRef<SpeechSynthesisUtterance | null>(null);
  const phoneVibrationAudioRef = useRef<HTMLAudioElement | null>(null);
  const selectedMusicRef = useRef<MusicOptionId>(readMusicState().selectedMusicId);
  const musicMutedRef = useRef(readMusicState().muted);
  const musicVolumeRef = useRef(readMusicState().volume);
  const gameRunRef = useRef<GameWorksheetRunSnapshot | null>(null);
  const gameCostStateRef = useRef<LaptopCostState>({
    error: null,
    events: [],
    loading: false,
    summary: null
  });
  const paperTextureRef = useRef<Texture | null>(null);
  const phoneScreenTextureRef = useRef<Texture | null>(null);
  const phoneQuoteIndexRef = useRef(-1);
  const worksheetPlaybackRef = useRef<WorksheetPlaybackState>(DEFAULT_WORKSHEET_PLAYBACK);
  const phoneRewardPendingRef = useRef(false);
  const phoneScreenModeRef = useRef<PhoneScreenMode>("off");
  const selectedLessonIdRef = useRef<GameLessonId | null>(null);
  const gamePipelineRequestRef = useRef(0);
  const gameLessonInstructorIdRef = useRef<string | null>(null);
  const [selectedLessonId, setSelectedLessonId] = useState<GameLessonId | null>(null);
  const [lockedMessage, setLockedMessage] = useState<string | null>(null);
  const [pointedCoordinates, setPointedCoordinates] = useState("-- --");
  const [started, setStarted] = useState(false);
  const [worksheetFocused, setWorksheetFocused] = useState(false);
  const [focusedMode, setFocusedMode] = useState<FocusMode>("room");
  const [clockPanelVisible, setClockPanelVisible] = useState(false);
  const [interactiveTarget, setInteractiveTarget] = useState<InteractiveTarget>(null);
  const [laptopTab, setLaptopTab] = useState<LaptopTab>("demo");
  const [laptopLoginLoading, setLaptopLoginLoading] = useState(false);
  const [loginError, setLoginError] = useState<string | null>(initialLoginError);
  const [user, setUser] = useState<CurrentUser | null>(initialUser);
  const [pomodoro, setPomodoro] = useState<PomodoroState>(() => initialUser ? readPomodoroState() : {endsAt: null, minutes: 25});
  const [pomodoroNow, setPomodoroNow] = useState(() => Date.now());
  const [selectedMusicId, setSelectedMusicId] = useState<MusicOptionId>(() => readMusicState().selectedMusicId);
  const [musicMuted, setMusicMuted] = useState(() => readMusicState().muted);
  const [musicVolume, setMusicVolume] = useState(() => readMusicState().volume);
  const [gameRun, setGameRun] = useState<GameWorksheetRunSnapshot | null>(null);
  const [gameCostState, setGameCostState] = useState<LaptopCostState>({
    error: null,
    events: [],
    loading: false,
    summary: null
  });
  const [worksheetPlayback, setWorksheetPlayback] = useState<WorksheetPlaybackState>(DEFAULT_WORKSHEET_PLAYBACK);
  const [phoneRewardPending, setPhoneRewardPending] = useState(false);
  const [phoneScreenMode, setPhoneScreenMode] = useState<PhoneScreenMode>("off");
  const [gamePipelineLoading, setGamePipelineLoading] = useState(false);
  const [gamePipelineLoadingStage, setGamePipelineLoadingStage] = useState<GameLessonStage | null>(null);
  const [gamePipelineError, setGamePipelineError] = useState<string | null>(null);
  const [pointerLocked, setPointerLocked] = useState(false);
  const [sceneEditorHud, setSceneEditorHud] = useState<string | null>(null);
  const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone || "local time";
  const pomodoroRemaining = pomodoro.endsAt ? Math.max(0, pomodoro.endsAt - pomodoroNow) : 0;

  userRef.current = user;
  pomodoroRef.current = pomodoro;
  selectedMusicRef.current = selectedMusicId;
  musicMutedRef.current = musicMuted;
  musicVolumeRef.current = musicVolume;
  gameRunRef.current = gameRun;
  gameCostStateRef.current = gameCostState;
  worksheetPlaybackRef.current = worksheetPlayback;
  phoneRewardPendingRef.current = phoneRewardPending;
  phoneScreenModeRef.current = phoneScreenMode;
  selectedLessonIdRef.current = selectedLessonId;

  function updatePointedCoordinates(point: Vector3 | null) {
    const next = point ? `${Math.round(point.x * 100)} ${Math.round(point.z * 100)}` : "-- --";
    setPointedCoordinates((current) => (current === next ? current : next));
  }

  useEffect(() => {
    if (!user) {
      setPhoneRewardSnapshot(false, {persist: false});
      return;
    }
    void refreshGameProgressFromApi().catch(() => {
      const pending = readPhoneRewardState(user.id);
      setPhoneRewardSnapshot(pending, {persist: false});
    });
  }, [user]);

  useEffect(() => {
    void refreshGameUsageCosts();
  }, [user]);

  function updateFocusMode(mode: FocusMode) {
    focusModeRef.current = mode;
    setFocusedMode(mode);
    setWorksheetFocused(mode === "paper");
    setClockPanelVisible(false);
  }

  async function signInFromLaptop(formData: FormData) {
    const username = String(formData.get("username") ?? "");
    const password = String(formData.get("password") ?? "");
    const email = usernameToAuthEmail(username);
    if (!email) {
      setLoginError("Username or password was not accepted.");
      laptopScreenRef.current?.setError("Username or password was not accepted.");
      return;
    }
    setLaptopLoginLoading(true);
    laptopScreenRef.current?.setLoading(true);
    laptopScreenRef.current?.setError(null);
    const supabase = createClient();
    const {data, error} = await supabase.auth.signInWithPassword({email, password});
    setLaptopLoginLoading(false);
    laptopScreenRef.current?.setLoading(false);
    if (error || !data.user) {
      setLoginError("Username or password was not accepted.");
      laptopScreenRef.current?.setError("Username or password was not accepted.");
      return;
    }
    const nextUser: CurrentUser = {
      id: data.user.id,
      email: data.user.email ?? email,
      displayName: usernameFromAuthEmail(data.user.email ?? email),
      creditBalance: 0
    };
    setLoginError(null);
    gamePipelineRequestRef.current += 1;
    setUser(nextUser);
    laptopScreenRef.current?.updateUser(nextUser);
    setGamePipelineError(null);
    laptopScreenRef.current?.setPipelineState({error: null, loading: gamePipelineLoading, loadingStage: gamePipelineLoadingStage, run: gameRunRef.current});
    if (data.session?.access_token) {
      void refreshGameProgressFromApi(data.session.access_token);
    }
    void refreshGameUsageCosts();
  }

  async function signOutFromLaptop() {
    const supabase = createClient();
    await supabase.auth.signOut();
    gamePipelineRequestRef.current += 1;
    clearSectionPlayback();
    writePomodoroState({endsAt: null, minutes: 25});
    setPhoneRewardSnapshot(false, {persist: false});
    setPomodoro({endsAt: null, minutes: 25});
    setUser(null);
    setGameRun(null);
    setGameCostSnapshot({error: null, events: [], loading: false, summary: null});
    setWorksheetPlayback(DEFAULT_WORKSHEET_PLAYBACK);
    selectedLessonIdRef.current = null;
    setSelectedLessonId(null);
    setGamePipelineError(null);
    laptopScreenRef.current?.updateUser(null);
    laptopScreenRef.current?.setPipelineState({error: null, loading: false, loadingStage: null, run: null});
    refreshPaperTexture(paperTextureRef.current, null, null, null, worksheetPlaybackRef.current);
  }

  function setPomodoroMinutes(minutes: number) {
    const next = {endsAt: null, minutes};
    setPomodoro(next);
    writePomodoroState(next);
  }

  function startPomodoro() {
    const next = {minutes: pomodoroRef.current.minutes, endsAt: Date.now() + pomodoroRef.current.minutes * 60_000};
    setPomodoro(next);
    writePomodoroState(next);
  }

  function stopPomodoro() {
    const next = {endsAt: null, minutes: pomodoroRef.current.minutes};
    setPomodoro(next);
    writePomodoroState(next);
  }

  function changeLaptopTab(tab: LaptopTab) {
    setLaptopTab(tab);
    laptopScreenRef.current?.setTab(tab);
    if (tab === "costs") {
      void refreshGameUsageCosts();
    }
  }

  function changeMusic(selectedMusicId: MusicOptionId) {
    const next = {muted: musicMutedRef.current, selectedMusicId, volume: musicVolumeRef.current};
    setSelectedMusicId(selectedMusicId);
    writeMusicState(next);
    laptopScreenRef.current?.setMusicState(next);
  }

  function changeMusicMuted(muted: boolean) {
    const next = {muted, selectedMusicId: selectedMusicRef.current, volume: musicVolumeRef.current};
    setMusicMuted(muted);
    writeMusicState(next);
    laptopScreenRef.current?.setMusicState(next);
  }

  function changeMusicVolume(volume: number) {
    const clamped = clampMusicVolume(volume);
    const next = {muted: musicMutedRef.current, selectedMusicId: selectedMusicRef.current, volume: clamped};
    setMusicVolume(clamped);
    writeMusicState(next);
    laptopScreenRef.current?.setMusicState(next);
  }

  function playPomodoroAlarm() {
    if (typeof window === "undefined") {
      return;
    }
    const audio = alarmAudioRef.current ?? new Audio(ALARM_SOUND_URL);
    alarmAudioRef.current = audio;
    audio.currentTime = 0;
    void audio.play().catch(() => {
      // Browsers can block playback without recent user activation; the visual timer state still completes.
    });
  }

  function startPhoneRewardVibration() {
    if (typeof window === "undefined") {
      return;
    }
    const audio = phoneVibrationAudioRef.current ?? new Audio(PHONE_VIBRATION_SOUND_URL);
    phoneVibrationAudioRef.current = audio;
    audio.loop = true;
    audio.currentTime = 0;
    void audio.play().catch(() => {
      // Reward state is still visible if autoplay rules block the vibration audio.
    });
  }

  function stopPhoneRewardVibration() {
    const audio = phoneVibrationAudioRef.current;
    if (!audio) {
      return;
    }
    audio.pause();
    audio.currentTime = 0;
  }

  function setPhoneRewardSnapshot(pending: boolean, options: {persist: boolean} = {persist: true}) {
    phoneRewardPendingRef.current = pending;
    setPhoneRewardPending(pending);
    if (userRef.current) {
      writePhoneRewardState(userRef.current.id, pending);
    }
    if (pending) {
      setPhoneScreenModeSnapshot("reward");
      startPhoneRewardVibration();
    } else {
      stopPhoneRewardVibration();
      setPhoneScreenModeSnapshot(focusModeRef.current === "phone" ? "quote" : "off");
    }
    if (options.persist && userRef.current) {
      void persistGameProgress({
        action: pending ? "set_phone_reward" : "clear_phone_reward",
        lessonId: GAME_LESSON_TEMPLATE_ID
      });
    }
  }

  function setPhoneScreenModeSnapshot(mode: PhoneScreenMode) {
    phoneScreenModeRef.current = mode;
    setPhoneScreenMode(mode);
    refreshPhoneScreenTexture(phoneScreenTextureRef.current, mode, PHONE_FOCUS_QUOTES[Math.max(0, phoneQuoteIndexRef.current)]);
  }

  function setGameRunSnapshot(snapshot: GameWorksheetRunSnapshot | null) {
    setGameRun(snapshot);
    const nextPlayback = snapshot ? readWorksheetPlaybackState(snapshot.id) : DEFAULT_WORKSHEET_PLAYBACK;
    setWorksheetPlayback(nextPlayback);
    laptopScreenRef.current?.setPipelineState({error: null, loading: false, loadingStage: null, run: snapshot});
    refreshPaperTexture(paperTextureRef.current, selectedLessonIdRef.current, null, snapshot, nextPlayback);
    if (snapshot && userRef.current) {
      void refreshGameProgressFromApi();
    }
  }

  function setGameCostSnapshot(snapshot: LaptopCostState) {
    gameCostStateRef.current = snapshot;
    setGameCostState(snapshot);
    laptopScreenRef.current?.setCostState(snapshot);
  }

  async function refreshGameUsageCosts() {
    if (!userRef.current) {
      setGameCostSnapshot({error: null, events: [], loading: false, summary: null});
      return;
    }
    setGameCostSnapshot({...gameCostStateRef.current, error: null, loading: true});
    try {
      const accessToken = await getLaptopAccessToken();
      const [summary, eventsResponse] = await Promise.all([
        getGameUsageSummary(accessToken),
        getGameUsageEvents(accessToken, 30)
      ]);
      setGameCostSnapshot({
        error: null,
        events: eventsResponse.events,
        loading: false,
        summary
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Could not load game usage costs.";
      setGameCostSnapshot({
        ...gameCostStateRef.current,
        error: message,
        loading: false
      });
    }
  }

  function setWorksheetPlaybackSnapshot(nextPlayback: WorksheetPlaybackState) {
    setWorksheetPlayback(nextPlayback);
    if (gameRunRef.current) {
      writeWorksheetPlaybackState(gameRunRef.current.id, nextPlayback);
    }
    refreshPaperTexture(paperTextureRef.current, selectedLessonIdRef.current, null, gameRunRef.current, nextPlayback);
    if (userRef.current) {
      void persistGameProgress({
        action: "update_lesson_playback",
        lessonId: GAME_LESSON_TEMPLATE_ID,
        worksheetPlayback: toApiWorksheetPlayback(nextPlayback)
      });
    }
  }

  function clearSectionPlayback() {
    if (sectionCompletionTimerRef.current !== null) {
      window.clearTimeout(sectionCompletionTimerRef.current);
      sectionCompletionTimerRef.current = null;
    }
    const audio = sectionAudioRef.current;
    if (audio) {
      audio.pause();
      audio.currentTime = 0;
    }
    sectionAudioRef.current = null;
    if (typeof window !== "undefined" && "speechSynthesis" in window) {
      window.speechSynthesis.cancel();
    }
    sectionSpeechUtteranceRef.current = null;
  }

  function startWorksheetSectionPlayback(run: GameWorksheetRunSnapshot, sectionId: string) {
    clearSectionPlayback();
    const startedAt = Date.now();
    const durationMs = sectionPlaybackDurationMs(run, sectionId);
    const nextPlayback: WorksheetPlaybackState = {
      ...worksheetPlaybackRef.current,
      activeSectionId: sectionId,
      activeSectionStartedAt: startedAt,
      completedSectionIds: worksheetPlaybackRef.current.completedSectionIds.filter((id) => id !== sectionId),
      lessonCompletedAt: null
    };
    setWorksheetPlaybackSnapshot(nextPlayback);
    playWorksheetSectionNarration(run, sectionId);
    sectionCompletionTimerRef.current = window.setTimeout(() => {
      const current = worksheetPlaybackRef.current;
      if (current.activeSectionId !== sectionId || current.activeSectionStartedAt !== startedAt) {
        return;
      }
      setWorksheetPlaybackSnapshot({
        ...current,
        activeSectionId: null,
        activeSectionStartedAt: null,
        completedSectionIds: [...new Set([...current.completedSectionIds, sectionId])]
      });
    }, durationMs);
  }

  function playWorksheetSectionNarration(run: GameWorksheetRunSnapshot, sectionId: string) {
    const narration = worksheetNarrationForSection(run, sectionId);
    if (!narration?.speechText && !narration?.audioUrl) {
      return;
    }
    if (narration.audioUrl) {
      const audio = new Audio(narration.audioUrl);
      sectionAudioRef.current = audio;
      void audio.play().catch(() => {
        playWorksheetSpeechPreview(narration.speechText ?? "");
      });
      return;
    }
    playWorksheetSpeechPreview(narration.speechText ?? "");
  }

  function playWorksheetSpeechPreview(speechText: string) {
    if (typeof window === "undefined" || !("speechSynthesis" in window) || !speechText.trim()) {
      return;
    }
    const utterance = new SpeechSynthesisUtterance(speechText.replaceAll(/<break[^>]*\/>/g, ". "));
    utterance.rate = 0.92;
    utterance.pitch = 1;
    utterance.volume = musicMutedRef.current ? 0.85 : 0.72;
    sectionSpeechUtteranceRef.current = utterance;
    window.speechSynthesis.speak(utterance);
  }

  function handleLaptopLoginSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void signInFromLaptop(new FormData(event.currentTarget));
  }

  async function getLaptopAccessToken() {
    const supabase = createClient();
    const {
      data: {session}
    } = await supabase.auth.getSession();
    if (!session?.access_token) {
      throw new Error("Login on the laptop to start this lesson.");
    }
    return session.access_token;
  }

  async function updateGameLessonProgress(action: "start_lesson" | "complete_lesson") {
    try {
      await persistGameProgress({action, lessonId: GAME_LESSON_TEMPLATE_ID});
    } catch (error) {
      if (process.env.NODE_ENV === "development") {
        console.warn("[quadratics] could not update game lesson progress", error);
      }
    }
  }

  async function persistGameProgress(request: Parameters<typeof updateGameProgress>[0]["request"]) {
    const accessToken = await getLaptopAccessToken();
    return updateGameProgress({accessToken, request});
  }

  async function refreshGameProgressFromApi(accessTokenOverride?: string) {
    const accessToken = accessTokenOverride ?? await getLaptopAccessToken();
    const progress = await getGameProgress(accessToken);
    applyGameProgress(progress);
  }

  function applyGameProgress(progress: GameProgress) {
    const lesson = progress.lessons.find((entry) => entry.lessonId === GAME_LESSON_TEMPLATE_ID);
    const nextPlayback = worksheetPlaybackFromApi(lesson?.metadata?.worksheetPlayback);
    setWorksheetPlayback(nextPlayback);
    if (gameRunRef.current) {
      writeWorksheetPlaybackState(gameRunRef.current.id, nextPlayback);
    }
    refreshPaperTexture(paperTextureRef.current, selectedLessonIdRef.current, null, gameRunRef.current, nextPlayback);
    setPhoneRewardSnapshot(lesson?.metadata?.phoneRewardPending === true, {persist: false});
  }

  async function resolveGameLessonInstructorId(accessToken: string): Promise<string | null> {
    if (gameLessonInstructorIdRef.current) {
      return gameLessonInstructorIdRef.current;
    }
    try {
      const instructors = await listInstructors(accessToken);
      const defaultInstructor = instructors.find(isDefaultGameLessonInstructor) ?? instructors[0] ?? null;
      gameLessonInstructorIdRef.current = defaultInstructor?.id ?? null;
      return gameLessonInstructorIdRef.current;
    } catch (error) {
      if (process.env.NODE_ENV === "development") {
        console.warn("[quadratics] could not resolve game lesson instructor", error);
      }
      return null;
    }
  }

  function isDefaultGameLessonInstructor(instructor: Instructor): boolean {
    return instructor.id === "male" || instructor.displayName.trim().toLowerCase() === "male instructor";
  }

  function canReuseGameLessonRun(run: GameWorksheetRunSnapshot | null, selectedInstructorId: string | null): run is GameWorksheetRunSnapshot {
    if (!run || run.templateId !== GAME_LESSON_TEMPLATE_ID) {
      return false;
    }
    return run.selectedInstructorId === selectedInstructorId;
  }

  async function prepareGameLessonRun(params: {forceTemplate?: boolean} = {}) {
    const requestId = gamePipelineRequestRef.current + 1;
    gamePipelineRequestRef.current = requestId;
    const requestingUserId = userRef.current?.id;
    if (!requestingUserId) {
      throw new Error("Login on the laptop to start this lesson.");
    }
    setGamePipelineLoading(true);
    setGamePipelineLoadingStage("template");
    setGamePipelineError(null);
    laptopScreenRef.current?.setPipelineState({error: null, loading: true, loadingStage: "template", run: gameRunRef.current});
    try {
      const accessToken = await getLaptopAccessToken();
      const selectedInstructorId = await resolveGameLessonInstructorId(accessToken);
      const existingRun = gameRunRef.current;
      const run =
        canReuseGameLessonRun(existingRun, selectedInstructorId)
          ? existingRun
          : await createGameLessonRun({
              accessToken,
              selectedInstructorId,
              templateId: GAME_LESSON_TEMPLATE_ID
            });
      const snapshot = await runGameLessonStage({
        accessToken,
        force: params.forceTemplate ?? false,
        runId: run.id,
        stage: "template"
      });
      if (gamePipelineRequestRef.current !== requestId || userRef.current?.id !== requestingUserId) {
        return null;
      }
      setGameRunSnapshot(snapshot);
      void refreshGameUsageCosts();
      return snapshot;
    } catch (error) {
      const message = error instanceof Error ? error.message : "Could not start the worksheet run.";
      if (gamePipelineRequestRef.current !== requestId || userRef.current?.id !== requestingUserId) {
        return null;
      }
      setGamePipelineError(message);
      laptopScreenRef.current?.setPipelineState({error: message, loading: false, loadingStage: null, run: gameRunRef.current});
      throw error;
    } finally {
      if (gamePipelineRequestRef.current === requestId && userRef.current?.id === requestingUserId) {
        setGamePipelineLoading(false);
        setGamePipelineLoadingStage(null);
      }
    }
  }

  async function runGameLessonPipelineStage(stage: GameLessonStage, params: {force?: boolean} = {}) {
    const requestId = gamePipelineRequestRef.current + 1;
    gamePipelineRequestRef.current = requestId;
    const requestingUserId = userRef.current?.id;
    if (!requestingUserId) {
      throw new Error("Login on the laptop to start this lesson.");
    }
    setGamePipelineLoading(true);
    setGamePipelineLoadingStage(stage);
    setGamePipelineError(null);
    laptopScreenRef.current?.setPipelineState({error: null, loading: true, loadingStage: stage, run: gameRunRef.current});
    try {
      const accessToken = await getLaptopAccessToken();
      const selectedInstructorId = await resolveGameLessonInstructorId(accessToken);
      const existingRun =
        canReuseGameLessonRun(gameRunRef.current, selectedInstructorId)
          ? gameRunRef.current
          : await createGameLessonRun({
              accessToken,
              selectedInstructorId,
              templateId: GAME_LESSON_TEMPLATE_ID
            });
      const snapshot = await runGameLessonStage({
        accessToken,
        force: params.force ?? false,
        runId: existingRun.id,
        stage
      });
      if (gamePipelineRequestRef.current !== requestId || userRef.current?.id !== requestingUserId) {
        return null;
      }
      setGameRunSnapshot(snapshot);
      void refreshGameUsageCosts();
      return snapshot;
    } catch (error) {
      const message = error instanceof Error ? error.message : `Could not run ${stage}.`;
      if (gamePipelineRequestRef.current !== requestId || userRef.current?.id !== requestingUserId) {
        return null;
      }
      setGamePipelineError(message);
      laptopScreenRef.current?.setPipelineState({error: message, loading: false, loadingStage: null, run: gameRunRef.current});
      throw error;
    } finally {
      if (gamePipelineRequestRef.current === requestId && userRef.current?.id === requestingUserId) {
        setGamePipelineLoading(false);
        setGamePipelineLoadingStage(null);
      }
    }
  }

  async function resetGameLessonProgress() {
    if (!userRef.current) {
      throw new Error("Login on the laptop to reset progress.");
    }
    setGamePipelineError(null);
    laptopScreenRef.current?.setPipelineState({error: null, loading: gamePipelineLoading, loadingStage: gamePipelineLoadingStage, run: gameRunRef.current});
    try {
      const accessToken = await getLaptopAccessToken();
      await resetGameProgress(accessToken);
      clearSectionPlayback();
      setWorksheetPlayback(DEFAULT_WORKSHEET_PLAYBACK);
      if (gameRunRef.current) {
        writeWorksheetPlaybackState(gameRunRef.current.id, DEFAULT_WORKSHEET_PLAYBACK);
      }
      setPhoneRewardSnapshot(false, {persist: false});
      selectedLessonIdRef.current = null;
      setSelectedLessonId(null);
      refreshPaperTexture(paperTextureRef.current, null, null, gameRunRef.current, DEFAULT_WORKSHEET_PLAYBACK);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Could not reset lesson progress.";
      setGamePipelineError(message);
      laptopScreenRef.current?.setPipelineState({error: message, loading: false, loadingStage: null, run: gameRunRef.current});
      throw error;
    }
  }

  async function approveGameLessonPipelineArtifact(artifact: GameLessonArtifact) {
    const requestId = gamePipelineRequestRef.current + 1;
    gamePipelineRequestRef.current = requestId;
    const requestingUserId = userRef.current?.id;
    if (!requestingUserId) {
      throw new Error("Login on the laptop to start this lesson.");
    }
    setGamePipelineLoading(true);
    setGamePipelineLoadingStage(artifact.stage);
    setGamePipelineError(null);
    laptopScreenRef.current?.setPipelineState({error: null, loading: true, loadingStage: artifact.stage, run: gameRunRef.current});
    try {
      const accessToken = await getLaptopAccessToken();
      await approveGameLessonArtifact({
        accessToken,
        artifactId: artifact.id,
        decision: "approved",
        notes: "Approved from laptop pipeline console."
      });
      const snapshot = await runGameLessonStage({
        accessToken,
        force: false,
        runId: artifact.runId,
        stage: "template"
      });
      if (gamePipelineRequestRef.current !== requestId || userRef.current?.id !== requestingUserId) {
        return null;
      }
      setGameRunSnapshot(snapshot);
      void refreshGameUsageCosts();
      return snapshot;
    } catch (error) {
      const message = error instanceof Error ? error.message : "Could not approve worksheet artifact.";
      if (gamePipelineRequestRef.current !== requestId || userRef.current?.id !== requestingUserId) {
        return null;
      }
      setGamePipelineError(message);
      laptopScreenRef.current?.setPipelineState({error: message, loading: false, loadingStage: null, run: gameRunRef.current});
      throw error;
    } finally {
      if (gamePipelineRequestRef.current === requestId && userRef.current?.id === requestingUserId) {
        setGamePipelineLoading(false);
        setGamePipelineLoadingStage(null);
      }
    }
  }

  function startGameLesson(choiceId: GameLessonId, texture: Texture | null) {
    if (!userRef.current) {
      const message = "Login on the laptop to start this lesson.";
      setLockedMessage(message);
      selectedLessonIdRef.current = null;
      setSelectedLessonId(null);
      setGamePipelineError(message);
      laptopScreenRef.current?.setTab("pipeline");
      laptopScreenRef.current?.setPipelineState({
        error: message,
        loading: false,
        loadingStage: null,
        run: gameRunRef.current
      });
      refreshPaperTexture(texture, null, choiceId, gameRunRef.current, worksheetPlaybackRef.current);
      return;
    }
    if (choiceId === GAME_LESSON_TEMPLATE_ID && !isGameLessonPublished(gameRunRef.current)) {
      const message = "Publish the Lesson 1 pipeline before opening the worksheet.";
      setLockedMessage(message);
      setGamePipelineError(message);
      laptopScreenRef.current?.setTab("pipeline");
      laptopScreenRef.current?.setPipelineState({
        error: message,
        loading: false,
        loadingStage: null,
        run: gameRunRef.current
      });
      changeLaptopTab("pipeline");
      void prepareGameLessonRun().catch(() => {
        // The laptop pipeline tab carries the actionable error for the user.
      });
      return;
    }
    setLockedMessage(null);
    selectedLessonIdRef.current = choiceId;
    setSelectedLessonId(choiceId);
    refreshPaperTexture(texture, choiceId, choiceId, gameRunRef.current, worksheetPlaybackRef.current);
    changeLaptopTab("pipeline");
    void updateGameLessonProgress("start_lesson");
    void prepareGameLessonRun().catch(() => {
      // The laptop pipeline tab carries the actionable error for the user.
    });
  }

  useEffect(() => {
    let disposed = false;
    let renderer: WebGLRenderer | null = null;
    let cssRenderer: CSS3DRenderer | null = null;
    let scene: Scene | null = null;
    let camera: PerspectiveCamera | null = null;
    let animationFrame: number | null = null;
    let resizeObserver: ResizeObserver | null = null;
    let paperMesh: Mesh | null = null;
    let paperTexture: Texture | null = null;
    let penGroup: Group | null = null;
    let steamGroup: Group | null = null;
    let rainStreaks: Mesh[] = [];
    let clockTexture: Texture | null = null;
    let phoneScreenTexture: Texture | null = null;
    let musicIframe: HTMLIFrameElement | null = null;
    let laptopScreenApi: LaptopScreenApi | null = null;
    let hoveredChoiceId: GameLessonId | null = null;
    let sceneEditorSelection: SceneTunableName = "laptop";
    const sceneTunables: Partial<Record<SceneTunableName, Object3D>> = {};
    const pointerTarget = {x: 1.08, z: 0.82 + DESK_RIG_Z};
    const cameraTarget = {x: 0, y: 2.85, z: SEATED_CAMERA_Z};
    const lookTarget = {x: 0, y: 1.52, z: -2.25 + DESK_RIG_Z};
    const lookAngles = {yaw: 0, pitch: -0.2};
    const cleanupCallbacks: Array<() => void> = [];
    let laptopInteractionTimer: number | null = null;
    let clockPanelTimer: number | null = null;
    let pointerLockRequestPending = false;
    let lastPointerLockRequestAt = 0;

    function postMusicCommand(command: "mute" | "playVideo" | "setVolume" | "unMute", args: unknown[] = []) {
      musicIframe?.contentWindow?.postMessage(JSON.stringify({event: "command", func: command, args}), "https://www.youtube.com");
    }

    function requestScenePointerLock({pauseOnFailure = true}: {pauseOnFailure?: boolean} = {}) {
      if (!renderer?.domElement || document.pointerLockElement === renderer.domElement || pointerLockRequestPending) {
        return document.pointerLockElement === renderer?.domElement;
      }
      const now = window.performance.now();
      if (now - lastPointerLockRequestAt < 700) {
        return false;
      }
      lastPointerLockRequestAt = now;
      pointerLockRequestPending = true;
      try {
        const lockRequest = renderer.domElement.requestPointerLock();
        void Promise.resolve(lockRequest)
          .catch((error: unknown) => {
            if (process.env.NODE_ENV === "development") {
              console.warn("[quadratics] pointer lock request skipped", error);
            }
            if (pauseOnFailure && startedRef.current && document.pointerLockElement !== renderer?.domElement) {
              startedRef.current = false;
              setStarted(false);
            }
          })
          .finally(() => {
            pointerLockRequestPending = false;
          });
      } catch (error) {
        pointerLockRequestPending = false;
        if (process.env.NODE_ENV === "development") {
          console.warn("[quadratics] pointer lock request skipped", error);
        }
        if (pauseOnFailure && startedRef.current) {
          startedRef.current = false;
          setStarted(false);
        }
      }
      return true;
    }

    function startExperience() {
      const didRequestPointerLock = requestScenePointerLock();
      if (!didRequestPointerLock) {
        startedRef.current = false;
        setStarted(false);
        return;
      }
      startedRef.current = true;
      setStarted(true);
      postMusicCommand("playVideo");
      postMusicCommand(musicMutedRef.current ? "mute" : "unMute");
      postMusicCommand("setVolume", [musicVolumeRef.current]);
    }

    function pauseExperience() {
      startedRef.current = false;
      setStarted(false);
      setFocusMode("room");
      document.exitPointerLock?.();
    }

    function setFocusMode(mode: FocusMode) {
      focusModeRef.current = mode;
      worksheetFocusedRef.current = mode === "paper";
      updateFocusMode(mode);
      setCssRendererInteraction(cssRenderer, false);
      if (laptopInteractionTimer !== null) {
        window.clearTimeout(laptopInteractionTimer);
        laptopInteractionTimer = null;
      }
      if (clockPanelTimer !== null) {
        window.clearTimeout(clockPanelTimer);
        clockPanelTimer = null;
      }
      const nextPhoneMode: PhoneScreenMode = phoneRewardPendingRef.current
        ? "reward"
        : mode === "phone"
          ? "quote"
          : "off";
      setPhoneScreenModeSnapshot(nextPhoneMode);
      applyFocusCamera(mode, 0, 0);
      if (mode === "laptop") {
        setCssRendererVisibility(cssRenderer, false);
      } else {
        setCssRendererVisibility(cssRenderer, true);
      }
      if (mode === "clock") {
        clockPanelTimer = window.setTimeout(() => {
          if (focusModeRef.current === "clock") {
            setClockPanelVisible(true);
          }
        }, 520);
      }
      setLockedMessage(null);
      if (mode !== "paper") {
        hoveredChoiceId = null;
        refreshPaperTexture(paperTexture, selectedLessonIdRef.current, null, gameRunRef.current, worksheetPlaybackRef.current);
      }
    }
    focusModeSetterRef.current = setFocusMode;
    cleanupCallbacks.push(() => {
      if (focusModeSetterRef.current === setFocusMode) {
        focusModeSetterRef.current = null;
      }
    });

    function applyFocusCamera(mode: FocusMode, pointerX: number, pointerY: number) {
      if (mode === "paper") {
        cameraTarget.x = pointerX * 0.12;
        cameraTarget.y = 7.15;
        cameraTarget.z = 3.75 + DESK_RIG_Z + pointerY * 0.06;
        lookTarget.x = 0;
        lookTarget.y = DESK_SURFACE_Y + 0.02;
        lookTarget.z = -0.35 + DESK_RIG_Z;
      } else if (mode === "laptop") {
        cameraTarget.x = -2.12 + pointerX * 0.035;
        cameraTarget.y = 2.12 + pointerY * 0.025;
        cameraTarget.z = 0.92 + DESK_RIG_Z;
        lookTarget.x = -3.68;
        lookTarget.y = 2.02;
        lookTarget.z = -1.49 + DESK_RIG_Z;
      } else if (mode === "clock") {
        cameraTarget.x = 2.35 + pointerX * 0.05;
        cameraTarget.y = 2.14 + pointerY * 0.04;
        cameraTarget.z = 1.05 + DESK_RIG_Z;
        lookTarget.x = 3.2;
        lookTarget.y = 1.43;
        lookTarget.z = -2.0 + DESK_RIG_Z;
      } else if (mode === "map") {
        cameraTarget.x = ROOM.rightWallX - 3.72 + pointerX * 0.055;
        cameraTarget.y = 3.18 + pointerY * 0.025;
        cameraTarget.z = -1.6;
        lookTarget.x = ROOM.rightWallX - 0.08;
        lookTarget.y = 3.18;
        lookTarget.z = -1.6;
      } else if (mode === "phone") {
        cameraTarget.x = 3.72;
        cameraTarget.y = 3.48;
        cameraTarget.z = 1.64 + DESK_RIG_Z;
        lookTarget.x = 3.72;
        lookTarget.y = DESK_SURFACE_Y + 0.065;
        lookTarget.z = 1.64 + DESK_RIG_Z;
      } else {
        applyRoomLook(pointerX, pointerY);
      }
    }

    function applyRoomLook(pointerX: number, pointerY: number) {
      const horizontalRange = 1.32;
      const horizontalLookDistance = 8.2;
      const yaw = Math.max(-horizontalRange, Math.min(horizontalRange, lookAngles.yaw));
      cameraTarget.x = 0;
      cameraTarget.y = 2.85;
      cameraTarget.z = SEATED_CAMERA_Z;
      lookTarget.x = cameraTarget.x + Math.sin(yaw) * horizontalLookDistance + pointerX * 0.18;
      lookTarget.y = 1.66 + Math.sin(lookAngles.pitch) * 2.2 + pointerY * 0.12;
      lookTarget.z = cameraTarget.z - Math.cos(yaw) * horizontalLookDistance;
    }

    async function setupScene() {
      const mount = mountRef.current;
      if (!mount) {
        return;
      }

      const THREE = await import("three");
      const {CSS3DObject, CSS3DRenderer} = await import("three/examples/jsm/renderers/CSS3DRenderer.js");
      const {GLTFLoader} = await import("three/examples/jsm/loaders/GLTFLoader.js");
      if (disposed || !mountRef.current) {
        return;
      }

      scene = new THREE.Scene();
      scene.background = new THREE.Color(0x090b12);

      camera = new THREE.PerspectiveCamera(44, 16 / 9, 0.1, 80);
      camera.position.set(0, 2.85, SEATED_CAMERA_Z);
      camera.lookAt(0, 1.52, -2.25 + DESK_RIG_Z);

      try {
        renderer = new THREE.WebGLRenderer({alpha: false, antialias: true});
      } catch {
        return;
      }
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
      renderer.outputColorSpace = THREE.SRGBColorSpace;
      renderer.toneMapping = THREE.ACESFilmicToneMapping;
      renderer.toneMappingExposure = 0.78;
      renderer.shadowMap.enabled = true;
      renderer.domElement.className = "absolute inset-0 h-full w-full cursor-none";
      renderer.domElement.style.zIndex = "0";
      mount.append(renderer.domElement);

      cssRenderer = new CSS3DRenderer();
      cssRenderer.domElement.className = "absolute inset-0 h-full w-full";
      cssRenderer.domElement.style.pointerEvents = "none";
      cssRenderer.domElement.style.cursor = "none";
      cssRenderer.domElement.style.overflow = "hidden";
      cssRenderer.domElement.style.zIndex = "10";
      mount.append(cssRenderer.domElement);

      const hemiLight = new THREE.HemisphereLight(0x9fb7d8, 0x0d0908, 0.42);
      scene.add(hemiLight);

      const overheadTarget = new THREE.Object3D();
      overheadTarget.position.set(0, 0.05, -0.2);
      scene.add(overheadTarget);

      const overheadLight = new THREE.SpotLight(0xffe2a8, 7.2, 13, Math.PI / 5.8, 0.6, 1.2);
      overheadLight.position.set(0.25, 6.5, 1.5);
      overheadLight.target = overheadTarget;
      overheadLight.castShadow = true;
      overheadLight.shadow.mapSize.set(2048, 2048);
      overheadLight.shadow.camera.near = 0.5;
      overheadLight.shadow.camera.far = 15;
      scene.add(overheadLight);

      const windowGlow = new THREE.DirectionalLight(0x8bbcff, 1.45);
      windowGlow.position.set(0, 3.2, -4.3);
      scene.add(windowGlow);

      const neonFill = new THREE.PointLight(0xc946ff, 2.1, 9, 2.1);
      neonFill.position.set(3.7, 2.4, -3.8);
      scene.add(neonFill);

      const backdrop = createOfficeBackdrop(THREE);
      rainStreaks = backdrop.rainStreaks;
      scene.add(backdrop.group);
      sceneTunables.map = backdrop.mapGroup;
      let visitorLocation: VisitorLocation | null = null;
      let worldMap: WorldMapGeoJson | null = null;
      const refreshVisitorMap = () => updateWorldMapTexture(backdrop.mapTexture, visitorLocation, worldMap);
      void loadVisitorLocation().then((location) => {
        if (disposed) {
          return;
        }
        visitorLocation = location;
        refreshVisitorMap();
      });
      void loadWorldMapGeoJson().then((geoJson) => {
        if (disposed) {
          return;
        }
        worldMap = geoJson;
        refreshVisitorMap();
      });
      const deskRig = new THREE.Group();
      deskRig.name = "desk-rig";
      deskRig.position.z = DESK_RIG_Z;
      scene.add(deskRig);

      deskRig.add(createDeskSurface(THREE));
      const supplies = createDeskSupplies(THREE);
      steamGroup = supplies.steamGroup;
      clockTexture = supplies.clockTexture;
      phoneScreenTexture = supplies.phoneScreenTexture;
      phoneScreenTextureRef.current = phoneScreenTexture;
      refreshPhoneScreenTexture(
        phoneScreenTexture,
        phoneScreenModeRef.current,
        PHONE_FOCUS_QUOTES[Math.max(0, phoneQuoteIndexRef.current)]
      );
      deskRig.add(supplies.group);
      sceneTunables.clock = supplies.clock;
      sceneTunables.coffee = supplies.coffeeGroup;
      sceneTunables.phone = supplies.phoneGroup;
      const laptop = createDeskLaptop(THREE);
      const laptopScreen = createLaptopScreen(CSS3DObject, {
        costs: gameCostStateRef.current,
        error: loginError,
        onCreateRun: () => {
          void prepareGameLessonRun().catch(() => {
            // The laptop pipeline tab renders the failure inline.
          });
        },
        onApproveArtifact: (artifact) => {
          void approveGameLessonPipelineArtifact(artifact).catch(() => {
            // The laptop pipeline tab renders the failure inline.
          });
        },
        onRunStage: (stage, options) => {
          void runGameLessonPipelineStage(stage, {force: options?.force ?? false}).catch(() => {
            // The laptop pipeline tab renders the failure inline.
          });
        },
        onResetProgress: () => {
          void resetGameLessonProgress().catch(() => {
            // The laptop pipeline tab renders the failure inline.
          });
        },
        musicMuted: musicMutedRef.current,
        onSignIn: signInFromLaptop,
        onSignOut: signOutFromLaptop,
        onMusicChange: changeMusic,
        onMusicMutedChange: changeMusicMuted,
        onMusicVolumeChange: changeMusicVolume,
        onTabChange: (tab) => {
          setLaptopTab(tab);
          if (tab === "costs") {
            void refreshGameUsageCosts();
          }
        },
        origin: window.location.origin,
        musicVolume: musicVolumeRef.current,
        selectedMusicId: selectedMusicRef.current,
        pipeline: {error: gamePipelineError, loading: gamePipelineLoading, loadingStage: gamePipelineLoadingStage, run: gameRunRef.current},
        tab: laptopTab,
        user: userRef.current
      });
      laptopScreenApi = laptopScreen.api;
      laptopScreenRef.current = laptopScreen.api;
      musicIframe = laptopScreen.iframe;
      laptop.add(laptopScreen.object);
      sceneTunables.laptop = laptop;
      deskRig.add(laptop);

      const clockTimer = window.setInterval(() => {
        const now = Date.now();
        const currentPomodoro = pomodoroRef.current;
        if (currentPomodoro.endsAt !== null && currentPomodoro.endsAt <= now) {
          const next = {endsAt: null, minutes: currentPomodoro.minutes};
          playPomodoroAlarm();
          setPomodoro(next);
          writePomodoroState(next);
          refreshClockTexture(clockTexture, next);
          setPomodoroNow(now);
          return;
        }
        setPomodoroNow(now);
        refreshClockTexture(clockTexture, currentPomodoro);
      }, 1_000);
      cleanupCallbacks.push(() => window.clearInterval(clockTimer));

      paperTexture = createWorksheetTexture(THREE, selectedLessonIdRef.current, null, gameRunRef.current, worksheetPlaybackRef.current);
      paperTextureRef.current = paperTexture;
      paperMesh = createPaper(THREE, paperTexture);
      sceneTunables.paper = paperMesh;
      deskRig.add(paperMesh);

      penGroup = createRaisedPenCursor(THREE);
      penGroup.visible = worksheetFocusedRef.current;
      scene.add(penGroup);
      const fallbackPenGroup = penGroup;
      const penLoader = new GLTFLoader();
      void penLoader
        .loadAsync("/game/assets/models/office-pack/Pens.glb")
        .then((gltf) => {
          if (disposed || !scene) {
            return;
          }
          const tablePen = createDeskPenModel(THREE, gltf.scene);
          tablePen.visible = !worksheetFocusedRef.current;
          deskRig.add(tablePen);
          penGroup = fallbackPenGroup;
          sceneTunables.pen = tablePen;
        })
        .catch((error: unknown) => {
          if (process.env.NODE_ENV === "development") {
            console.warn("[quadratics] could not load office pen model", error);
          }
        });

      const raycaster = new THREE.Raycaster();
      const pointer = new THREE.Vector2();
      let lastInteractiveTarget: InteractiveTarget = null;
      applyRoomLook(0, 0);

      function setTarget(target: InteractiveTarget) {
        if (target === lastInteractiveTarget) {
          return;
        }
        lastInteractiveTarget = target;
        setInteractiveTarget(target);
      }

      function pickTarget() {
        const selectedLaptop = sceneTunables.laptop;
        const selectedClock = sceneTunables.clock;
        const selectedMap = sceneTunables.map;
        const selectedPhone = sceneTunables.phone;
        if (selectedLaptop && raycaster.intersectObject(selectedLaptop, true).length > 0) {
          return "laptop";
        }
        if (selectedClock && raycaster.intersectObject(selectedClock, true).length > 0) {
          return "clock";
        }
        if (selectedMap && raycaster.intersectObject(selectedMap, true).length > 0) {
          return "map";
        }
        if (selectedPhone && raycaster.intersectObject(selectedPhone, true).length > 0) {
          return "phone";
        }
        if (paperMesh && raycaster.intersectObject(paperMesh).length > 0) {
          return "paper";
        }
        return null;
      }

      function updatePointer(event: PointerEvent) {
        if (!renderer || !camera || !paperMesh) {
          return;
        }
        const rect = renderer.domElement.getBoundingClientRect();
        if (focusModeRef.current === "paper") {
          pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
          pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
        } else if (pointerLockedRef.current && focusModeRef.current === "room") {
          lookAngles.yaw = Math.max(-1.32, Math.min(1.32, lookAngles.yaw + event.movementX * 0.0022));
          lookAngles.pitch = Math.max(-0.78, Math.min(1.22, lookAngles.pitch - event.movementY * 0.0022));
          pointer.set(0, 0);
        } else {
          pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
          pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
        }
        if (focusModeRef.current === "room") {
          if (!pointerLockedRef.current) {
            lookAngles.yaw = pointer.x * 1.32;
            lookAngles.pitch = Math.max(-0.78, Math.min(1.22, -0.28 + pointer.y * 0.58));
          }
        }
        applyFocusCamera(focusModeRef.current, pointer.x, pointer.y);
        if (focusModeRef.current === "room") {
          applyRoomLook(pointer.x, pointer.y);
        }
        raycaster.setFromCamera(pointer, camera);
        if (focusModeRef.current === "room") {
          setTarget(pickTarget());
        } else {
          setTarget(null);
        }
        const coordinateTargets: Object3D[] = [];
        const selectedLaptop = sceneTunables.laptop;
        const selectedClock = sceneTunables.clock;
        const selectedMap = sceneTunables.map;
        const selectedPhone = sceneTunables.phone;
        if (paperMesh) coordinateTargets.push(paperMesh);
        if (selectedLaptop) coordinateTargets.push(selectedLaptop);
        if (selectedClock) coordinateTargets.push(selectedClock);
        if (selectedMap) coordinateTargets.push(selectedMap);
        if (selectedPhone) coordinateTargets.push(selectedPhone);
        updatePointedCoordinates(raycaster.intersectObjects(coordinateTargets, true)[0]?.point ?? null);
        const [hit] = raycaster.intersectObject(paperMesh);
        if (!hit || !hit.uv || focusModeRef.current !== "paper") {
          hoveredChoiceId = null;
          refreshPaperTexture(paperTexture, selectedLessonIdRef.current, hoveredChoiceId, gameRunRef.current, worksheetPlaybackRef.current);
          return;
        }
        pointerTarget.x = hit.point.x;
        pointerTarget.z = hit.point.z;
        const canvasX = hit.uv.x * WORKSHEET_CANVAS_WIDTH;
        const canvasY = (1 - hit.uv.y) * WORKSHEET_CANVAS_HEIGHT;
        if (selectedLessonIdRef.current === GAME_LESSON_TEMPLATE_ID && gameRunRef.current?.templateId === GAME_LESSON_TEMPLATE_ID) {
          if (hoveredChoiceId !== null) {
            hoveredChoiceId = null;
            refreshPaperTexture(paperTexture, selectedLessonIdRef.current, null, gameRunRef.current, worksheetPlaybackRef.current);
          }
          return;
        }
        const nextHover = choiceAtCanvasPoint(canvasX, canvasY)?.id ?? null;
        if (nextHover !== hoveredChoiceId) {
          hoveredChoiceId = nextHover;
          refreshPaperTexture(paperTexture, selectedLessonIdRef.current, hoveredChoiceId, gameRunRef.current, worksheetPlaybackRef.current);
        }
      }

      function activatePointer(event: PointerEvent) {
        if (!renderer || !camera || !paperMesh) {
          return;
        }
        if (!startedRef.current) {
          return;
        }
        if (focusModeRef.current === "phone") {
          if (phoneScreenModeRef.current === "reward") {
            setPhoneScreenModeSnapshot("rickroll");
            void persistGameProgress({
              action: "claim_easter_egg",
              easterEggId: "lesson_1_phone_reward",
              lessonId: GAME_LESSON_TEMPLATE_ID
            });
          }
          return;
        }
        if (worksheetFocusedRef.current) {
          const rect = renderer.domElement.getBoundingClientRect();
          pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
          pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
        } else if (!pointerLockedRef.current) {
          const rect = renderer.domElement.getBoundingClientRect();
          pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
          pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
        } else {
          pointer.set(0, 0);
        }
        raycaster.setFromCamera(pointer, camera);
        const selectedLaptop = sceneTunables.laptop;
        if (!worksheetFocusedRef.current && selectedLaptop && raycaster.intersectObject(selectedLaptop, true).length > 0) {
          setFocusMode("laptop");
          document.exitPointerLock?.();
          return;
        }
        const selectedClock = sceneTunables.clock;
        if (!worksheetFocusedRef.current && selectedClock && raycaster.intersectObject(selectedClock, true).length > 0) {
          setFocusMode("clock");
          document.exitPointerLock?.();
          return;
        }
        const selectedMap = sceneTunables.map;
        if (!worksheetFocusedRef.current && selectedMap && raycaster.intersectObject(selectedMap, true).length > 0) {
          setFocusMode("map");
          document.exitPointerLock?.();
          return;
        }
        const selectedPhone = sceneTunables.phone;
        if (!worksheetFocusedRef.current && selectedPhone && raycaster.intersectObject(selectedPhone, true).length > 0) {
          phoneQuoteIndexRef.current = (phoneQuoteIndexRef.current + 1) % PHONE_FOCUS_QUOTES.length;
          if (phoneRewardPendingRef.current) {
            setPhoneRewardSnapshot(false);
            setFocusMode("phone");
            setPhoneScreenModeSnapshot("reward");
          } else {
            setFocusMode("phone");
            setPhoneScreenModeSnapshot("quote");
          }
          document.exitPointerLock?.();
          return;
        }
        const [hit] = raycaster.intersectObject(paperMesh);
        if (!hit?.uv) {
          if (!worksheetFocusedRef.current && pointerLockedRef.current && lookAngles.pitch < -0.33) {
            setFocusMode("paper");
            document.exitPointerLock?.();
            return;
          }
          if (!worksheetFocusedRef.current && !pointerLockedRef.current) {
            requestScenePointerLock();
          }
          return;
        }
        if (!worksheetFocusedRef.current) {
          setFocusMode("paper");
          document.exitPointerLock?.();
          return;
        }
        const canvasX = hit.uv.x * WORKSHEET_CANVAS_WIDTH;
        const canvasY = (1 - hit.uv.y) * WORKSHEET_CANVAS_HEIGHT;
        if (selectedLessonIdRef.current === GAME_LESSON_TEMPLATE_ID && gameRunRef.current?.templateId === GAME_LESSON_TEMPLATE_ID) {
          const action = worksheetActionAtCanvasPoint(canvasX, canvasY, gameRunRef.current, worksheetPlaybackRef.current);
          if (action?.type === "section") {
            setLockedMessage(null);
            startWorksheetSectionPlayback(gameRunRef.current, action.section.id);
            changeLaptopTab("pipeline");
          } else if (action?.type === "next_page") {
            setLockedMessage(null);
            clearSectionPlayback();
            setWorksheetPlaybackSnapshot({...worksheetPlaybackRef.current, activeSectionId: null, activeSectionStartedAt: null, currentPageId: action.pageId});
          } else if (action?.type === "complete_lesson") {
            setLockedMessage(null);
            clearSectionPlayback();
            const nextPlayback = {...worksheetPlaybackRef.current, lessonCompletedAt: Date.now()};
            setWorksheetPlaybackSnapshot(nextPlayback);
            void updateGameLessonProgress("complete_lesson");
            window.setTimeout(() => {
              if (worksheetPlaybackRef.current.lessonCompletedAt === nextPlayback.lessonCompletedAt && userRef.current) {
                setPhoneRewardSnapshot(true);
              }
            }, 5_000);
          }
          return;
        }
        const choice = choiceAtCanvasPoint(canvasX, canvasY);
        if (!choice) {
          return;
        }
        if (choice.locked) {
          setLockedMessage("Lesson 2 is locked while the generated worksheet pipeline is being designed.");
          selectedLessonIdRef.current = null;
          setSelectedLessonId(null);
          refreshPaperTexture(paperTexture, null, choice.id, gameRunRef.current, worksheetPlaybackRef.current);
          return;
        }
        startGameLesson(choice.id, paperTexture);
      }

      renderer.domElement.addEventListener("pointermove", updatePointer);
      renderer.domElement.addEventListener("pointerdown", activatePointer);
      cleanupCallbacks.push(() => renderer?.domElement.removeEventListener("pointermove", updatePointer));
      cleanupCallbacks.push(() => renderer?.domElement.removeEventListener("pointerdown", activatePointer));

      function handleKeyDown(event: KeyboardEvent) {
        if (handleSceneEditorKey(event)) {
          return;
        }
        const target = event.target;
        const isLaptopTyping =
          target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement || target instanceof HTMLSelectElement;
        if (isLaptopTyping && event.key !== "Escape") {
          return;
        }
        if (event.code === "Space") {
          event.preventDefault();
          if (startedRef.current) {
            pauseExperience();
          } else {
            startExperience();
          }
          return;
        }
        if (event.key === "Escape") {
          if (focusModeRef.current !== "room") {
            event.preventDefault();
            setFocusMode("room");
            requestScenePointerLock({pauseOnFailure: false});
          }
        }
      }
      window.addEventListener("keydown", handleKeyDown);
      cleanupCallbacks.push(() => window.removeEventListener("keydown", handleKeyDown));

      const sceneEditorEnabled =
        process.env.NODE_ENV === "development" && new URLSearchParams(window.location.search).has("sceneEditor");
      if (sceneEditorEnabled) {
        refreshSceneEditorHud();
      }

      function handleSceneEditorKey(event: KeyboardEvent) {
        if (!sceneEditorEnabled) {
          return false;
        }
        const selected = sceneTunables[sceneEditorSelection];
        const orderedNames: SceneTunableName[] = ["laptop", "clock", "coffee", "paper", "map", "phone", "pen"];
        if (event.key === "Tab") {
          event.preventDefault();
          const currentIndex = orderedNames.indexOf(sceneEditorSelection);
          sceneEditorSelection = orderedNames[(currentIndex + 1) % orderedNames.length];
          refreshSceneEditorHud();
          return true;
        }
        if (!selected) {
          return false;
        }

        const moveStep = event.shiftKey ? 0.02 : 0.1;
        const rotateStep = event.shiftKey ? 0.02 : 0.08;
        const scaleStep = event.shiftKey ? 0.02 : 0.08;
        let handled = true;
        switch (event.key) {
          case "ArrowLeft":
            selected.position.x -= moveStep;
            break;
          case "ArrowRight":
            selected.position.x += moveStep;
            break;
          case "ArrowUp":
            selected.position.z -= moveStep;
            break;
          case "ArrowDown":
            selected.position.z += moveStep;
            break;
          case "PageUp":
            selected.position.y += moveStep;
            break;
          case "PageDown":
            selected.position.y -= moveStep;
            break;
          case "[":
            selected.rotation.y -= rotateStep;
            break;
          case "]":
            selected.rotation.y += rotateStep;
            break;
          case "-":
            selected.scale.multiplyScalar(Math.max(0.05, 1 - scaleStep));
            break;
          case "=":
          case "+":
            selected.scale.multiplyScalar(1 + scaleStep);
            break;
          case "c":
          case "C":
            void navigator.clipboard?.writeText(formatSceneTransform(sceneEditorSelection, selected));
            break;
          default:
            handled = false;
        }
        if (handled) {
          event.preventDefault();
          refreshSceneEditorHud();
        }
        return handled;
      }

      function refreshSceneEditorHud() {
        const selected = sceneTunables[sceneEditorSelection];
        if (!selected) {
          setSceneEditorHud(null);
          return;
        }
        setSceneEditorHud(formatSceneTransform(sceneEditorSelection, selected));
      }

      function handlePointerLockChange() {
        const isLocked = document.pointerLockElement === renderer?.domElement;
        pointerLockedRef.current = isLocked;
        setPointerLocked(isLocked);
      }
      document.addEventListener("pointerlockchange", handlePointerLockChange);
      cleanupCallbacks.push(() => document.removeEventListener("pointerlockchange", handlePointerLockChange));

      const resize = () => {
        if (!mountRef.current || !renderer || !camera) {
          return;
        }
        const rect = mountRef.current.getBoundingClientRect();
        renderer.setSize(rect.width, rect.height, false);
        cssRenderer?.setSize(rect.width, rect.height);
        camera.aspect = rect.width / Math.max(1, rect.height);
        camera.updateProjectionMatrix();
      };
      resizeObserver = new ResizeObserver(resize);
      resizeObserver.observe(mount);
      resize();

      const animate = () => {
        if (!renderer || !scene || !camera) {
          return;
        }
        camera.position.x += (cameraTarget.x - camera.position.x) * 0.045;
        camera.position.y += (cameraTarget.y - camera.position.y) * 0.045;
        camera.position.z += (cameraTarget.z - camera.position.z) * 0.045;
        camera.lookAt(lookTarget.x, lookTarget.y, lookTarget.z);
        if (penGroup) {
          penGroup.visible = worksheetFocusedRef.current;
          penGroup.position.x += (pointerTarget.x - penGroup.position.x) * 0.18;
          penGroup.position.y += (DESK_SURFACE_Y + 0.12 - penGroup.position.y) * 0.18;
          penGroup.position.z += (pointerTarget.z - penGroup.position.z) * 0.18;
        }
        const deskPen = sceneTunables.pen;
        if (deskPen) {
          deskPen.visible = !worksheetFocusedRef.current;
        }
        if (worksheetPlaybackRef.current.activeSectionId && selectedLessonIdRef.current === GAME_LESSON_TEMPLATE_ID) {
          refreshPaperTexture(paperTexture, selectedLessonIdRef.current, null, gameRunRef.current, worksheetPlaybackRef.current);
        }
        if (steamGroup) {
          const elapsed = performance.now() / 1000;
          for (const [index, child] of steamGroup.children.entries()) {
            const baseY = typeof child.userData.baseY === "number" ? child.userData.baseY : child.position.y;
            child.position.y = baseY + Math.sin(elapsed * 1.2 + index) * 0.06;
            child.rotation.y = Math.sin(elapsed * 0.8 + index * 0.7) * 0.28;
          }
        }
        for (const [index, rain] of rainStreaks.entries()) {
          const speed = typeof rain.userData.speed === "number" ? rain.userData.speed : 0.018;
          rain.position.y -= speed;
          if (rain.position.y < ROOM.floorY + 0.08) {
            rain.position.y = ROOM.height - 0.35 - (index % 8) * 0.05;
          }
        }
        renderer.render(scene, camera);
        cssRenderer?.render(scene, camera);
        animationFrame = requestAnimationFrame(animate);
      };
      animate();
    }

    void setupScene();

    return () => {
      disposed = true;
      for (const cleanup of cleanupCallbacks) {
        cleanup();
      }
      if (animationFrame !== null) {
        cancelAnimationFrame(animationFrame);
      }
      clearSectionPlayback();
      resizeObserver?.disconnect();
      if (renderer) {
        renderer.dispose();
        renderer.domElement.remove();
      }
      cssRenderer?.domElement.remove();
      scene?.traverse((child) => {
        const mesh = child as Mesh & {
          geometry?: {dispose: () => void};
          material?: {dispose?: () => void} | Array<{dispose?: () => void}>;
        };
        mesh.geometry?.dispose();
        if (Array.isArray(mesh.material)) {
          for (const material of mesh.material) {
            material.dispose?.();
          }
        } else {
          mesh.material?.dispose?.();
        }
      });
      paperTexture?.dispose();
      setSceneEditorHud(null);
    };
  }, []);

  return (
    <section className="relative min-h-screen overflow-hidden bg-[#1c120a] text-zinc-100">
      <div aria-label="POV worksheet lesson selector" className="absolute inset-0" ref={mountRef}>
        <div className="grid h-full place-items-center bg-[radial-gradient(circle_at_center,rgba(251,191,36,0.18),rgba(24,15,9,1)_72%)] text-sm text-zinc-300">
          Loading desk scene
        </div>
      </div>

      {!started ? (
        <div className="absolute inset-0 z-30 grid place-items-center bg-zinc-950/72 backdrop-blur-[2px]">
          <div className="rounded border border-white/15 bg-zinc-950/45 px-8 py-5 text-center shadow-2xl">
            <p className="font-mono text-sm uppercase tracking-[0.28em] text-zinc-100">Press Space To Start</p>
          </div>
        </div>
      ) : null}

      <div className="pointer-events-none absolute left-5 top-5 rounded border border-cyan-200/20 bg-black/30 px-3 py-2 font-mono text-xs tracking-wide text-cyan-100/85 shadow-xl backdrop-blur-sm">
        {pointedCoordinates}
      </div>

      <div className="pointer-events-none absolute right-5 top-5 flex items-center gap-2 rounded border border-white/10 bg-black/30 px-3 py-2 font-mono text-[11px] uppercase tracking-wide text-zinc-300/80 shadow-xl backdrop-blur-sm">
        <span className="rounded border border-zinc-500/50 bg-zinc-900/70 px-2 py-1 text-zinc-100">Space</span>
        <span>pause</span>
        <span className="mx-1 text-zinc-600">/</span>
        <span className="rounded border border-zinc-500/50 bg-zinc-900/70 px-2 py-1 text-zinc-100">Esc</span>
        <span>back</span>
      </div>

      {focusedMode === "room" ? (
        <div className="pointer-events-none absolute left-1/2 top-1/2 z-10 h-8 w-8 -translate-x-1/2 -translate-y-1/2">
          <span className={`absolute left-1/2 top-0 h-2.5 w-px -translate-x-1/2 ${interactiveTarget ? "bg-emerald-300 shadow-[0_0_12px_rgba(110,231,183,0.75)]" : "bg-amber-50/80 shadow-[0_0_10px_rgba(255,244,210,0.45)]"}`} />
          <span className={`absolute bottom-0 left-1/2 h-2.5 w-px -translate-x-1/2 ${interactiveTarget ? "bg-emerald-300 shadow-[0_0_12px_rgba(110,231,183,0.75)]" : "bg-amber-50/80 shadow-[0_0_10px_rgba(255,244,210,0.45)]"}`} />
          <span className={`absolute left-0 top-1/2 h-px w-2.5 -translate-y-1/2 ${interactiveTarget ? "bg-emerald-300 shadow-[0_0_12px_rgba(110,231,183,0.75)]" : "bg-amber-50/80 shadow-[0_0_10px_rgba(255,244,210,0.45)]"}`} />
          <span className={`absolute right-0 top-1/2 h-px w-2.5 -translate-y-1/2 ${interactiveTarget ? "bg-emerald-300 shadow-[0_0_12px_rgba(110,231,183,0.75)]" : "bg-amber-50/80 shadow-[0_0_10px_rgba(255,244,210,0.45)]"}`} />
          <span className={`absolute left-1/2 top-1/2 h-1.5 w-1.5 -translate-x-1/2 -translate-y-1/2 rounded-full border ${interactiveTarget ? "border-emerald-300 bg-emerald-300/25" : "border-amber-50/70 bg-black/20"}`} />
        </div>
      ) : null}

      {sceneEditorHud ? (
        <div className="pointer-events-none absolute bottom-5 right-5 z-40 max-w-[28rem] rounded border border-cyan-200/25 bg-zinc-950/80 px-4 py-3 font-mono text-[11px] text-cyan-50/80 shadow-2xl backdrop-blur-md">
          <p className="mb-2 uppercase tracking-wide text-cyan-200">Scene tuner</p>
          <pre className="whitespace-pre-wrap">{sceneEditorHud}</pre>
          <p className="mt-2 text-cyan-100/55">Tab object / arrows move / PgUp PgDn height / [ ] rotate / +/- scale / C copy</p>
        </div>
      ) : null}

      {lockedMessage ? (
        <div className="pointer-events-none absolute bottom-6 left-1/2 w-[min(34rem,calc(100vw-2rem))] -translate-x-1/2 rounded border border-amber-300/40 bg-[#211307]/85 px-4 py-3 text-sm text-amber-50 shadow-2xl backdrop-blur-md">
          {lockedMessage}
        </div>
      ) : null}

      {focusedMode === "clock" && clockPanelVisible ? (
        <ClockFocusPanel
          minutes={pomodoro.minutes}
          onBack={() => {
            const setSceneFocusMode = focusModeSetterRef.current;
            if (setSceneFocusMode) {
              setSceneFocusMode("room");
            } else {
              updateFocusMode("room");
            }
          }}
          onMinutesChange={setPomodoroMinutes}
          onStart={startPomodoro}
          onStop={stopPomodoro}
          remainingMs={pomodoroRemaining}
          timezone={timezone}
        />
      ) : null}

      {focusedMode === "phone" && phoneScreenMode === "rickroll" ? <PhoneRewardVideoPanel /> : null}

      {focusedMode === "laptop" ? (
        <LaptopFocusPanel
          costs={gameCostState}
          error={loginError}
          onCreateRun={() => {
            void prepareGameLessonRun().catch(() => {
              // The focused laptop tab renders the failure inline.
            });
          }}
          onApproveArtifact={(artifact) => {
            void approveGameLessonPipelineArtifact(artifact).catch(() => {
              // The focused laptop tab renders the failure inline.
            });
          }}
          onRunStage={(stage, options) => {
            void runGameLessonPipelineStage(stage, {force: options?.force ?? false}).catch(() => {
              // The focused laptop tab renders the failure inline.
            });
          }}
          onResetProgress={() => {
            void resetGameLessonProgress().catch(() => {
              // The focused laptop tab renders the failure inline.
            });
          }}
          pipeline={{error: gamePipelineError, loading: gamePipelineLoading, loadingStage: gamePipelineLoadingStage, run: gameRun}}
          loading={laptopLoginLoading}
          musicMuted={musicMuted}
          musicVolume={musicVolume}
          onSignIn={handleLaptopLoginSubmit}
          onSignOut={() => void signOutFromLaptop()}
          onMusicChange={changeMusic}
          onMusicMutedChange={changeMusicMuted}
          onMusicVolumeChange={changeMusicVolume}
          onTabChange={changeLaptopTab}
          selectedMusicId={selectedMusicId}
          tab={laptopTab}
          user={user}
        />
      ) : null}

    </section>
  );
}

function ClockFocusPanel({
  minutes,
  onBack,
  onMinutesChange,
  onStart,
  onStop,
  remainingMs,
  timezone
}: {
  minutes: number;
  onBack: () => void;
  onMinutesChange: (minutes: number) => void;
  onStart: () => void;
  onStop: () => void;
  remainingMs: number;
  timezone: string;
}) {
  const running = remainingMs > 0;
  return (
    <div className="absolute bottom-8 right-8 z-30 w-[min(25rem,calc(100vw-2rem))] rounded border border-cyan-200/25 bg-[#050911]/90 p-4 shadow-2xl shadow-black/70 backdrop-blur-md">
      <div className="mb-4 flex items-start justify-between gap-3">
        <div>
          <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-cyan-100/60">Pomodoro timer</p>
          <h2 className="mt-1 font-mono text-3xl font-bold text-cyan-100 drop-shadow-[0_0_14px_rgba(103,232,249,0.35)]">
            {running ? formatPomodoroClock(remainingMs) : "READY"}
          </h2>
        </div>
        <button className="rounded border border-white/10 px-2.5 py-1.5 text-xs text-zinc-300 hover:border-cyan-200/40 hover:text-cyan-100" onClick={onBack} type="button">
          Back
        </button>
      </div>
      <div className="grid grid-cols-5 gap-2">
        {[5, 10, 15, 20, 25].map((value) => (
          <button
            className={`rounded border px-2 py-2 text-sm ${minutes === value ? "border-cyan-300/70 bg-cyan-400/15 text-cyan-100" : "border-zinc-700 bg-zinc-950/50 text-zinc-400 hover:text-zinc-100"}`}
            key={value}
            onClick={() => onMinutesChange(value)}
            type="button"
          >
            {value}
          </button>
        ))}
      </div>
      <div className="mt-4 flex gap-2">
        <button className="flex-1 rounded border border-emerald-400/60 bg-emerald-950/30 px-3 py-2 text-sm font-semibold text-emerald-100 hover:bg-emerald-900/40" onClick={onStart} type="button">
          Start
        </button>
        <button className="flex-1 rounded border border-red-400/35 bg-red-950/20 px-3 py-2 text-sm font-semibold text-red-100 hover:bg-red-900/30" onClick={onStop} type="button">
          Stop
        </button>
      </div>
      <p className="mt-3 text-xs text-zinc-500">Clock uses your browser time zone: {timezone}.</p>
    </div>
  );
}

function PhoneRewardVideoPanel() {
  return (
    <div className="pointer-events-none absolute inset-0 z-30 grid place-items-center">
      <div className="pointer-events-auto aspect-[9/16] h-[min(74vh,46rem)] overflow-hidden rounded-[2rem] border border-emerald-200/25 bg-black shadow-2xl shadow-emerald-950/30">
        <iframe
          allow="autoplay; encrypted-media; picture-in-picture"
          className="h-full w-full"
          src="https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ?autoplay=1&playsinline=1&rel=0&modestbranding=1"
          title="Lesson reward"
        />
      </div>
    </div>
  );
}

function usernameToAuthEmail(username: string) {
  const normalized = username.trim().toLowerCase();
  if (!/^[a-z0-9._-]{2,40}$/.test(normalized)) {
    return null;
  }
  return `${normalized}@quadratics.xyz`;
}

function usernameFromAuthEmail(email: string) {
  return email.endsWith("@quadratics.xyz") ? email.slice(0, -"@quadratics.xyz".length) : email.split("@")[0];
}

function accountDisplayName(user: CurrentUser) {
  return user.displayName || (user.email ? usernameFromAuthEmail(user.email) : "user");
}

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

async function loadVisitorLocation(): Promise<VisitorLocation | null> {
  try {
    const response = await fetch("/api/visitor-location", {cache: "no-store"});
    if (!response.ok) {
      return null;
    }
    return await response.json() as VisitorLocation;
  } catch {
    return null;
  }
}

async function loadWorldMapGeoJson(): Promise<WorldMapGeoJson | null> {
  try {
    const response = await fetch("/game/assets/maps/countries.geo.json", {cache: "force-cache"});
    if (!response.ok) {
      return null;
    }
    return await response.json() as WorldMapGeoJson;
  } catch {
    return null;
  }
}

function createDeskSurface(THREE: typeof import("three")) {
  const group = new THREE.Group();
  const deskTexture = createWoodTexture(THREE, 0x82512b, 0x3f2518);
  deskTexture.repeat.set(3.2, 1.45);
  const deskMaterial = new THREE.MeshStandardMaterial({map: deskTexture, color: 0x8d5b34, roughness: 0.74, metalness: 0.03});
  const edgeMaterial = new THREE.MeshStandardMaterial({color: 0x2b1910, roughness: 0.8, metalness: 0.02});

  const desktop = new THREE.Mesh(new THREE.BoxGeometry(9.65, 0.18, 5.35), deskMaterial);
  desktop.position.set(0, DESK_SURFACE_Y - 0.09, 0.04);
  desktop.castShadow = true;
  desktop.receiveShadow = true;
  group.add(desktop);

  const frontLip = new THREE.Mesh(new THREE.BoxGeometry(9.72, 0.16, 0.12), edgeMaterial);
  frontLip.position.set(0, DESK_SURFACE_Y - 0.12, 2.76);
  frontLip.castShadow = true;
  group.add(frontLip);

  const backLip = frontLip.clone();
  backLip.position.z = -2.68;
  group.add(backLip);

  const matTexture = createLeatherTexture(THREE);
  const mat = new THREE.Mesh(
    new THREE.BoxGeometry(3.25, 0.035, 4.05),
    new THREE.MeshStandardMaterial({map: matTexture, color: 0x24231f, roughness: 0.94, metalness: 0.03, bumpMap: matTexture, bumpScale: 0.035})
  );
  mat.position.set(0, DESK_SURFACE_Y + 0.006, 0.06);
  mat.receiveShadow = true;
  group.add(mat);

  return group;
}

function createOfficeBackdrop(THREE: typeof import("three")) {
  const group = new THREE.Group();
  const rainStreaks: Mesh[] = [];
  const wallMaterial = new THREE.MeshStandardMaterial({color: 0x111319, roughness: 0.92});
  const floorTexture = createConcreteTexture(THREE);
  const floorMaterial = new THREE.MeshStandardMaterial({map: floorTexture, color: 0x7a7c7d, roughness: 0.9, metalness: 0.02, bumpMap: floorTexture, bumpScale: 0.025});
  const ceilingMaterial = new THREE.MeshStandardMaterial({color: 0x080a0f, roughness: 0.9});

  const floor = new THREE.Mesh(new THREE.PlaneGeometry(ROOM.width, ROOM.depth), floorMaterial);
  floor.rotation.x = -Math.PI / 2;
  floor.position.set(0, ROOM.floorY, -0.05);
  floor.receiveShadow = true;
  group.add(floor);

  const rearWall = new THREE.Mesh(new THREE.PlaneGeometry(ROOM.width, ROOM.height), wallMaterial);
  rearWall.position.set(0, ROOM.height / 2, ROOM.depth / 2 - 0.05);
  rearWall.rotation.y = Math.PI;
  rearWall.receiveShadow = true;
  group.add(rearWall);

  const ceiling = new THREE.Mesh(new THREE.PlaneGeometry(ROOM.width, ROOM.depth), ceilingMaterial);
  ceiling.rotation.x = Math.PI / 2;
  ceiling.position.set(0, ROOM.height, -0.05);
  ceiling.receiveShadow = true;
  group.add(ceiling);

  const sideGlassMaterial = new THREE.MeshStandardMaterial({
    color: 0x111a24,
    emissive: 0x07111f,
    emissiveIntensity: 0.7,
    roughness: 0.22,
    metalness: 0.02,
    transparent: true,
    opacity: 0.6
  });

  const sideWall = new THREE.Mesh(new THREE.PlaneGeometry(ROOM.depth, ROOM.height), sideGlassMaterial.clone());
  sideWall.position.set(ROOM.leftWindowX, ROOM.height / 2, -0.05);
  sideWall.rotation.y = Math.PI / 2;
  sideWall.receiveShadow = true;
  group.add(sideWall);

  const rightWall = new THREE.Mesh(new THREE.PlaneGeometry(ROOM.depth, ROOM.height), wallMaterial);
  rightWall.position.set(ROOM.rightWallX, ROOM.height / 2, -0.05);
  rightWall.rotation.y = -Math.PI / 2;
  rightWall.receiveShadow = true;
  group.add(rightWall);

  const glass = new THREE.Mesh(
    new THREE.PlaneGeometry(ROOM.width, ROOM.height),
    new THREE.MeshStandardMaterial({
      color: 0x1a2a34,
      emissive: 0x0b1c2e,
      emissiveIntensity: 0.8,
      roughness: 0.18,
      metalness: 0.02,
      transparent: true,
      opacity: 0.72
    })
  );
  glass.position.set(0, ROOM.height / 2, ROOM.backWindowZ);
  group.add(glass);

  const backCity = createCityView(THREE, "back");
  const leftCity = createCityView(THREE, "left");
  rainStreaks.push(...backCity.rainStreaks, ...leftCity.rainStreaks);
  group.add(backCity.group);
  group.add(leftCity.group);

  const frameMaterial = new THREE.MeshStandardMaterial({color: 0x242a2e, roughness: 0.44, metalness: 0.22});
  for (const [x, y, width, height] of [
    [0, ROOM.height, ROOM.width, 0.16],
    [0, 0, ROOM.width, 0.16],
    [-ROOM.width / 2, ROOM.height / 2, 0.16, ROOM.height],
    [ROOM.width / 2, ROOM.height / 2, 0.16, ROOM.height],
    [0, ROOM.height / 2, 0.11, ROOM.height],
    [-2.65, ROOM.height / 2, 0.075, ROOM.height],
    [2.65, ROOM.height / 2, 0.075, ROOM.height]
  ] as const) {
    const rail = new THREE.Mesh(new THREE.BoxGeometry(width, height, 0.1), frameMaterial);
    rail.position.set(x, y, ROOM.backWindowZ + 0.18);
    rail.castShadow = true;
    group.add(rail);
  }

  const sideFrameMaterial = new THREE.MeshStandardMaterial({color: 0x1a1d22, roughness: 0.45, metalness: 0.25});
  for (const side of [-1]) {
    for (const [z, y, width, height] of [
      [-0.05, ROOM.height, ROOM.depth, 0.11],
      [-0.05, 0, ROOM.depth, 0.11],
      [-ROOM.depth / 2, ROOM.height / 2, 0.09, ROOM.height],
      [ROOM.depth / 2, ROOM.height / 2, 0.09, ROOM.height],
      [-1.65, ROOM.height / 2, 0.075, ROOM.height],
      [1.65, ROOM.height / 2, 0.075, ROOM.height]
    ] as const) {
      const frame = new THREE.Mesh(new THREE.BoxGeometry(width, height, 0.08), sideFrameMaterial);
      frame.position.set(side * (ROOM.width / 2 - 0.08), y, z);
      frame.rotation.y = side === -1 ? Math.PI / 2 : -Math.PI / 2;
      group.add(frame);
    }
  }

  const mapPanel = createRightWallMap(THREE);
  group.add(mapPanel.group);

  return {group, rainStreaks, mapGroup: mapPanel.group, mapTexture: mapPanel.texture};
}

function createCityView(THREE: typeof import("three"), side: "back" | "left") {
  const group = new THREE.Group();
  const rainStreaks: Mesh[] = [];
  const skylineMaterial = new THREE.MeshStandardMaterial({color: 0x121927, emissive: 0x0b1425, emissiveIntensity: 0.9, roughness: 0.82});
  const facadeMaterial = new THREE.MeshStandardMaterial({
    color: 0x1b2435,
    emissive: 0x101a32,
    emissiveIntensity: 0.55,
    roughness: 0.7,
    depthWrite: false
  });
  const rainMaterial = new THREE.MeshBasicMaterial({color: 0xa9d8ff, transparent: true, opacity: side === "left" ? 0.48 : 0.35, side: THREE.DoubleSide});
  const buildingBaseY = side === "left" ? -0.28 : 0.72;
  const litWindowBaseY = side === "left" ? 0.2 : 0.9;
  const cityBackZ = ROOM.backWindowZ - 0.34;
  const cityLeftX = ROOM.leftWindowX - 0.34;

  const buildingCount = side === "left" ? 58 : 34;
  for (let index = 0; index < buildingCount; index += 1) {
    const width = 0.22 + (index % 5) * 0.06;
    const depth = 0.12 + (index % 4) * 0.05;
    const height = (0.8 + ((index * 7) % 12) * 0.18) * (side === "left" ? 1.15 : 1);
    const x = -4.9 + index * 0.31;
    const z = side === "left" ? -ROOM.depth / 2 + 0.14 + index * (ROOM.depth / Math.max(1, buildingCount - 1)) : ROOM.backWindowZ - 0.32 + index * 0.15;
    const building =
      side === "back"
        ? new THREE.Mesh(new THREE.BoxGeometry(width, height, depth), skylineMaterial)
        : new THREE.Mesh(new THREE.BoxGeometry(depth, height, width), skylineMaterial);
    building.position.set(side === "back" ? x : cityLeftX, buildingBaseY + height / 2, side === "back" ? cityBackZ : z);
    group.add(building);

    if (index % 3 === 0) {
      const facade =
        side === "back"
          ? new THREE.Mesh(new THREE.BoxGeometry(width * 0.72, height * 0.24, 0.022), facadeMaterial)
          : new THREE.Mesh(new THREE.BoxGeometry(0.022, height * 0.24, width * 0.72), facadeMaterial);
      const sideFacadeX = cityLeftX + depth / 2 + 0.025;
      facade.position.set(
        side === "back" ? x : sideFacadeX,
        buildingBaseY + height * 0.72,
        side === "back" ? cityBackZ + depth / 2 + 0.018 : z
      );
      group.add(facade);
    }

    const windowRows = Math.max(2, Math.floor(height / 0.24));
    const windowCols = side === "back" ? 2 : 3;
    const windowColor = index % 5 === 0 ? 0xff58d2 : index % 3 === 0 ? 0x76f0ff : 0xffe186;
    for (let row = 0; row < windowRows; row += 1) {
      for (let col = 0; col < windowCols; col += 1) {
        if ((row + col + index) % 4 === 0) {
          continue;
        }
        const windowWidth = side === "back" ? width * 0.26 : width * 0.2;
        const windowHeight = side === "back" ? 0.028 : 0.04;
        const litWindow = new THREE.Mesh(
          new THREE.PlaneGeometry(windowWidth, windowHeight),
          new THREE.MeshBasicMaterial({
            color: windowColor,
            transparent: true,
            opacity: side === "left" ? 0.95 : 0.68,
            side: THREE.DoubleSide,
            depthWrite: false
          })
        );
        const columnOffset = (col - (windowCols - 1) / 2) * (side === "back" ? width * 0.28 : width * 0.22);
        const sideWindowX = cityLeftX + depth / 2 + 0.036;
        litWindow.position.set(
          side === "back" ? x + columnOffset : sideWindowX,
          litWindowBaseY + row * 0.19,
          side === "back" ? cityBackZ + depth / 2 + 0.062 : z + columnOffset
        );
        if (side === "left") {
          litWindow.rotation.y = Math.PI / 2;
        }
        group.add(litWindow);
      }
    }
  }

  if (side === "back") {
    const signTexture = createNeonSignTexture(THREE, "quadratics.xyz");
    const sign = new THREE.Mesh(
      new THREE.PlaneGeometry(1.45, 0.34),
      new THREE.MeshBasicMaterial({map: signTexture, transparent: true, side: THREE.DoubleSide})
    );
    sign.position.set(-1.34, 3.62, cityBackZ + 0.16);
    group.add(sign);
  }

  const rainCount = side === "left" ? 280 : 115;
  for (let index = 0; index < rainCount; index += 1) {
    const rain = new THREE.Mesh(new THREE.PlaneGeometry(0.006, 0.34), rainMaterial);
    const insideLeftRain = side === "left" && index % 3 === 0;
    rain.position.set(
      side === "back" ? -ROOM.width / 2 + Math.random() * ROOM.width : insideLeftRain ? ROOM.leftWindowX + 0.045 : ROOM.leftWindowX - 0.12 - (index % 3) * 0.1,
      ROOM.floorY + 0.12 + Math.random() * (ROOM.height - 0.18),
      side === "back" ? ROOM.backWindowZ - 0.08 : -ROOM.depth / 2 + Math.random() * ROOM.depth
    );
    rain.rotation.z = -0.24;
    if (side === "left") {
      rain.rotation.y = Math.PI / 2;
    }
    rain.userData.speed = 0.012 + Math.random() * 0.018;
    rainStreaks.push(rain);
    group.add(rain);
  }

  return {group, rainStreaks};
}

function createNeonSignTexture(THREE: typeof import("three"), label: string) {
  const canvas = document.createElement("canvas");
  canvas.width = 1024;
  canvas.height = 256;
  const context = canvas.getContext("2d");
  if (context) {
    context.clearRect(0, 0, canvas.width, canvas.height);
    const glow = context.createRadialGradient(canvas.width / 2, canvas.height / 2, 24, canvas.width / 2, canvas.height / 2, 460);
    glow.addColorStop(0, "rgba(31,255,188,0.22)");
    glow.addColorStop(0.42, "rgba(31,255,188,0.08)");
    glow.addColorStop(1, "rgba(31,255,188,0)");
    context.fillStyle = glow;
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.strokeStyle = "rgba(91,255,214,0.62)";
    context.lineWidth = 4;
    roundRect(context, 38, 50, canvas.width - 76, canvas.height - 100, 22);
    context.stroke();
    context.font = "900 78px ui-monospace, SFMono-Regular, Menlo, monospace";
    context.textAlign = "center";
    context.textBaseline = "middle";
    context.shadowColor = "rgba(80,255,210,0.95)";
    context.shadowBlur = 24;
    context.fillStyle = "#b7ffed";
    context.fillText(label, canvas.width / 2, canvas.height / 2 + 4);
    context.shadowBlur = 0;
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.needsUpdate = true;
  return texture;
}

function createRightWallMap(THREE: typeof import("three")) {
  const group = new THREE.Group();
  const texture = createWorldMapTexture(THREE, null);
  const frameMaterial = new THREE.MeshStandardMaterial({color: 0x11161f, roughness: 0.58, metalness: 0.2});
  const mapMaterial = new THREE.MeshBasicMaterial({map: texture, color: 0xffffff, side: THREE.DoubleSide});

  // The group is mounted on the right wall; child XY coordinates are the map face.
  const backing = new THREE.Mesh(new THREE.BoxGeometry(4.05, 2.24, 0.08), frameMaterial);
  backing.position.z = -0.035;
  backing.castShadow = true;
  backing.receiveShadow = true;
  group.add(backing);

  const map = new THREE.Mesh(new THREE.PlaneGeometry(3.76, 1.94), mapMaterial);
  map.position.z = 0.018;
  group.add(map);

  group.name = "visitor-world-map";
  group.position.set(ROOM.rightWallX - 0.09, 3.06, -1.7);
  group.rotation.y = -Math.PI / 2;
  return {group, texture};
}

function createWorldMapTexture(THREE: typeof import("three"), location: VisitorLocation | null, worldMap: WorldMapGeoJson | null = null) {
  const canvas = document.createElement("canvas");
  canvas.width = 1400;
  canvas.height = 720;
  drawWorldMap(canvas, location, worldMap);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.needsUpdate = true;
  return texture;
}

function updateWorldMapTexture(texture: Texture, location: VisitorLocation | null, worldMap: WorldMapGeoJson | null = null) {
  if (!(texture.image instanceof HTMLCanvasElement)) {
    return;
  }
  drawWorldMap(texture.image, location, worldMap);
  texture.needsUpdate = true;
}

function drawWorldMap(canvas: HTMLCanvasElement, location: VisitorLocation | null, worldMap: WorldMapGeoJson | null) {
  const context = canvas.getContext("2d");
  if (!context) {
    return;
  }
  context.clearRect(0, 0, canvas.width, canvas.height);
  const background = context.createLinearGradient(0, 0, canvas.width, canvas.height);
  background.addColorStop(0, "#0f1724");
  background.addColorStop(1, "#070b12");
  context.fillStyle = background;
  context.fillRect(0, 0, canvas.width, canvas.height);

  context.strokeStyle = "rgba(127,255,230,0.075)";
  context.lineWidth = 1;
  for (let x = 82; x < canvas.width; x += 82) {
    context.beginPath();
    context.moveTo(x, 0);
    context.lineTo(x, canvas.height);
    context.stroke();
  }
  for (let y = 72; y < canvas.height; y += 72) {
    context.beginPath();
    context.moveTo(0, y);
    context.lineTo(canvas.width, y);
    context.stroke();
  }

  const mapBounds = {x: 72, y: 104, width: canvas.width - 144, height: canvas.height - 166};
  context.save();
  context.beginPath();
  roundRect(context, mapBounds.x, mapBounds.y, mapBounds.width, mapBounds.height, 18);
  context.clip();
  context.fillStyle = "rgba(8,14,24,0.74)";
  context.fillRect(mapBounds.x, mapBounds.y, mapBounds.width, mapBounds.height);
  if (worldMap) {
    drawGeoJsonMap(context, mapBounds, worldMap);
  } else {
    context.font = "800 34px ui-monospace, SFMono-Regular, Menlo, monospace";
    context.textAlign = "center";
    context.textBaseline = "middle";
    context.fillStyle = "rgba(219,234,254,0.54)";
    context.fillText("LOADING MAP DATA", mapBounds.x + mapBounds.width / 2, mapBounds.y + mapBounds.height / 2);
    context.textAlign = "start";
    context.textBaseline = "alphabetic";
  }
  context.restore();

  context.strokeStyle = "rgba(127,255,230,0.24)";
  context.lineWidth = 2;
  roundRect(context, mapBounds.x, mapBounds.y, mapBounds.width, mapBounds.height, 18);
  context.stroke();

  context.fillStyle = "#dbeafe";
  context.font = "800 34px ui-monospace, SFMono-Regular, Menlo, monospace";
  context.fillText("VISITOR MAP", 54, 68);
  context.font = "500 24px ui-monospace, SFMono-Regular, Menlo, monospace";
  context.fillStyle = "rgba(219,234,254,0.62)";
  context.fillText(locationLabel(location), 54, 106);

  const pins = [...VISITOR_HISTORY_PINS];
  if (location !== null && location.latitude !== null && location.longitude !== null) {
    pins.push({
      current: true,
      label: locationLabel(location),
      latitude: location.latitude,
      longitude: location.longitude
    });
  }
  for (const pin of pins) {
    const point = projectGeoToCanvas(mapBounds, pin.latitude, pin.longitude);
    drawThumbtack(context, point.x, point.y, pin.current ? "#ffd76a" : "#ff4747", pin.current);
  }

  context.font = "700 22px ui-monospace, SFMono-Regular, Menlo, monospace";
  context.fillStyle = "rgba(219,234,254,0.58)";
  context.fillText("GOLD = CURRENT VISITOR", 54, canvas.height - 38);
  context.fillStyle = "rgba(255,120,120,0.74)";
  context.fillText("RED = RECORDED VISITS", 404, canvas.height - 38);
}

function drawGeoJsonMap(
  context: CanvasRenderingContext2D,
  bounds: {x: number; y: number; width: number; height: number},
  geoJson: WorldMapGeoJson
) {
  context.fillStyle = "#233852";
  context.strokeStyle = "rgba(151,215,255,0.5)";
  context.lineWidth = 1.8;
  for (const feature of geoJson.features) {
    const geometry = feature.geometry;
    if (!geometry) {
      continue;
    }
    const polygons = geometry.type === "Polygon" ? [geometry.coordinates] : geometry.coordinates;
    if (!isGeoJsonPolygons(polygons)) {
      continue;
    }
    for (const polygon of polygons) {
      drawGeoPolygon(context, bounds, polygon);
    }
  }
}

function isGeoJsonPolygons(value: unknown): value is number[][][][] {
  return Array.isArray(value);
}

function drawGeoPolygon(
  context: CanvasRenderingContext2D,
  bounds: {x: number; y: number; width: number; height: number},
  rings: number[][][]
) {
  context.beginPath();
  for (const ring of rings) {
    for (const [index, coordinate] of ring.entries()) {
      const [longitude, latitude] = coordinate;
      if (typeof latitude !== "number" || typeof longitude !== "number") {
        continue;
      }
      const point = projectGeoToCanvas(bounds, latitude, longitude);
      if (index === 0) {
        context.moveTo(point.x, point.y);
      } else {
        context.lineTo(point.x, point.y);
      }
    }
    context.closePath();
  }
  context.fill();
  context.stroke();
}

function projectGeoToCanvas(
  bounds: {x: number; y: number; width: number; height: number},
  latitude: number,
  longitude: number
) {
  const clampedLatitude = Math.max(-58, Math.min(78, latitude));
  return {
    x: bounds.x + ((longitude + 180) / 360) * bounds.width,
    y: bounds.y + ((78 - clampedLatitude) / 136) * bounds.height
  };
}

function drawThumbtack(context: CanvasRenderingContext2D, x: number, y: number, color: string, current = false) {
  context.save();
  context.shadowColor = current ? "rgba(255,215,106,0.95)" : "rgba(255,71,71,0.72)";
  context.shadowBlur = current ? 28 : 18;
  context.fillStyle = color;
  context.strokeStyle = current ? "#fff6bf" : "#fecaca";
  context.lineWidth = current ? 5 : 3;
  context.beginPath();
  context.arc(x, y - 18, current ? 17 : 13, 0, Math.PI * 2);
  context.fill();
  context.stroke();
  context.shadowBlur = 0;
  context.beginPath();
  context.moveTo(x - 7, y - 4);
  context.lineTo(x + 7, y - 4);
  context.lineTo(x, y + 26);
  context.closePath();
  context.fillStyle = current ? "#d69b1f" : "#b91c1c";
  context.fill();
  context.restore();
}

function locationLabel(location: VisitorLocation | null) {
  if (!location || location.latitude === null || location.longitude === null) {
    return "LOCATION PENDING";
  }
  return [location.city, location.region, location.country].filter(Boolean).join(" / ") || "VISITOR LOCATION";
}

function createDeskSupplies(THREE: typeof import("three")) {
  const group = new THREE.Group();
  group.position.y = DESK_SURFACE_Y;

  const clockTexture = createClockTexture(THREE);
  const clock = createClock(THREE, clockTexture);
  clock.position.set(3.22, 0.03, -2.05);
  clock.rotation.y = -0.26;
  group.add(clock);

  const coffee = createCoffeeCup(THREE);
  coffee.group.position.set(3.22, 0.03, -0.54);
  coffee.group.rotation.y = -0.32;
  group.add(coffee.group);

  const phone = createDeskPhone(THREE);
  group.add(phone.group);

  return {
    group,
    steamGroup: coffee.steamGroup,
    clockTexture,
    clock,
    coffeeGroup: coffee.group,
    phoneGroup: phone.group,
    phoneScreenTexture: phone.screenTexture
  };
}

function createDeskPhone(THREE: typeof import("three")) {
  const group = new THREE.Group();
  group.name = "desk-phone";
  group.position.set(3.72, 0.055, 1.64);
  group.rotation.y = -0.56;

  const bodyMaterial = new THREE.MeshStandardMaterial({color: 0x0b1118, roughness: 0.48, metalness: 0.22});
  const sideMaterial = new THREE.MeshStandardMaterial({color: 0x121a22, roughness: 0.42, metalness: 0.18});
  const edgeMaterial = new THREE.MeshStandardMaterial({color: 0x05080b, roughness: 0.4, metalness: 0.28});

  const body = new THREE.Mesh(new THREE.BoxGeometry(0.56, 0.045, 0.94), bodyMaterial);
  body.castShadow = true;
  body.receiveShadow = true;
  group.add(body);

  const edge = new THREE.Mesh(new THREE.BoxGeometry(0.61, 0.035, 0.99), edgeMaterial);
  edge.position.y = -0.012;
  edge.castShadow = true;
  group.add(edge);

  const screenTexture = createPhoneScreenTexture(THREE, "off");
  const screen = new THREE.Mesh(
    new THREE.PlaneGeometry(0.48, 0.78),
    new THREE.MeshBasicMaterial({map: screenTexture, color: 0xffffff, side: THREE.DoubleSide})
  );
  screen.rotation.x = -Math.PI / 2;
  screen.position.y = 0.028;
  screen.position.z = -0.012;
  group.add(screen);

  const notch = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.006, 0.018), sideMaterial);
  notch.position.set(0, 0.033, -0.38);
  group.add(notch);

  return {group, screenTexture};
}

function createPhoneScreenTexture(
  THREE: typeof import("three"),
  mode: PhoneScreenMode,
  quote?: {author: string; text: string}
) {
  const canvas = document.createElement("canvas");
  canvas.width = 512;
  canvas.height = 832;
  drawPhoneScreen(canvas, mode, quote);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.needsUpdate = true;
  return texture;
}

function refreshPhoneScreenTexture(texture: Texture | null, mode: PhoneScreenMode, quote?: {author: string; text: string}) {
  if (!texture) {
    return;
  }
  const image = texture.image;
  if (!(image instanceof HTMLCanvasElement)) {
    return;
  }
  drawPhoneScreen(image, mode, quote);
  texture.needsUpdate = true;
}

function setCssRendererInteraction(renderer: CSS3DRenderer | null, enabled: boolean) {
  if (!renderer) {
    return;
  }
  const pointerEvents = enabled ? "auto" : "none";
  renderer.domElement.style.pointerEvents = pointerEvents;
  renderer.domElement.style.cursor = enabled ? "auto" : "none";
  for (const element of Array.from(renderer.domElement.querySelectorAll<HTMLElement>("*"))) {
    element.style.pointerEvents = pointerEvents;
  }
}

function setCssRendererVisibility(renderer: CSS3DRenderer | null, visible: boolean) {
  if (!renderer) {
    return;
  }
  renderer.domElement.style.opacity = visible ? "1" : "0";
  renderer.domElement.style.visibility = visible ? "visible" : "hidden";
}

function drawPhoneScreen(canvas: HTMLCanvasElement, mode: PhoneScreenMode, quote?: {author: string; text: string}) {
  const context = canvas.getContext("2d");
  if (!context) {
    return;
  }
  const active = mode !== "off";
  context.clearRect(0, 0, canvas.width, canvas.height);
  const glass = context.createLinearGradient(0, 0, canvas.width, canvas.height);
  glass.addColorStop(0, active ? "#071720" : "#101820");
  glass.addColorStop(0.55, active ? "#061015" : "#17222b");
  glass.addColorStop(1, active ? "#030608" : "#0a0f14");
  context.fillStyle = glass;
  context.fillRect(0, 0, canvas.width, canvas.height);

  context.fillStyle = "rgba(255,255,255,0.08)";
  roundRect(context, canvas.width / 2 - 58, 22, 116, 12, 6);
  context.fill();

  if (!active) {
    return;
  }

  const glow = context.createRadialGradient(canvas.width / 2, 280, 10, canvas.width / 2, 280, 360);
  glow.addColorStop(0, "rgba(52,255,191,0.2)");
  glow.addColorStop(1, "rgba(52,255,191,0)");
  context.fillStyle = glow;
  context.fillRect(0, 0, canvas.width, canvas.height);

  context.strokeStyle = "rgba(94,255,214,0.42)";
  context.lineWidth = 3;
  roundRect(context, 48, 80, canvas.width - 96, canvas.height - 160, 30);
  context.stroke();

  if (mode === "reward" || mode === "rickroll") {
    context.font = "700 28px ui-monospace, SFMono-Regular, Menlo, monospace";
    context.fillStyle = "#7fffe6";
    context.textAlign = "left";
    context.fillText("LESSON COMPLETE", 76, 142);

    context.font = "900 42px ui-monospace, SFMono-Regular, Menlo, monospace";
    context.fillStyle = "#f8fafc";
    wrapCanvasText(
      context,
      mode === "rickroll" ? "Prize unlocked." : "Tap the gift to claim your prize.",
      76,
      238,
      canvas.width - 152,
      54
    );

    context.fillStyle = mode === "rickroll" ? "#38bdf8" : "#facc15";
    roundRect(context, 168, 500, 176, 128, 24);
    context.fill();
    context.strokeStyle = "rgba(255,255,255,0.6)";
    context.lineWidth = 7;
    context.beginPath();
    context.moveTo(256, 500);
    context.lineTo(256, 628);
    context.moveTo(168, 564);
    context.lineTo(344, 564);
    context.stroke();

    context.font = "800 24px ui-monospace, SFMono-Regular, Menlo, monospace";
    context.fillStyle = mode === "rickroll" ? "#dbeafe" : "#fef9c3";
    context.textAlign = "center";
    context.fillText(mode === "rickroll" ? "NEVER GONNA GIVE YOU UP" : "OPEN", canvas.width / 2, 700);
    return;
  }

  context.font = "700 28px ui-monospace, SFMono-Regular, Menlo, monospace";
  context.fillStyle = "#7fffe6";
  context.textAlign = "left";
  context.fillText("OPAL BLOCK", 76, 142);

  context.font = "800 42px ui-monospace, SFMono-Regular, Menlo, monospace";
  context.fillStyle = "#f8fafc";
  wrapCanvasText(context, "Deep work session active.", 76, 225, canvas.width - 152, 52);

  context.font = "600 30px ui-monospace, SFMono-Regular, Menlo, monospace";
  context.fillStyle = "#cbd5e1";
  const quoteEndY = wrapCanvasText(context, quote?.text ?? PHONE_FOCUS_QUOTES[0].text, 76, 435, canvas.width - 152, 42);

  context.font = "700 24px ui-monospace, SFMono-Regular, Menlo, monospace";
  context.fillStyle = "#8be8d1";
  context.fillText(`- ${quote?.author ?? PHONE_FOCUS_QUOTES[0].author}`, 76, quoteEndY + 46);
}

function wrapCanvasText(
  context: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  maxWidth: number,
  lineHeight: number
): number {
  const words = text.split(" ");
  let line = "";
  let currentY = y;
  for (const word of words) {
    const testLine = line ? `${line} ${word}` : word;
    if (context.measureText(testLine).width > maxWidth && line) {
      context.fillText(line, x, currentY);
      line = word;
      currentY += lineHeight;
    } else {
      line = testLine;
    }
  }
  if (line) {
    context.fillText(line, x, currentY);
  }
  return currentY;
}

function createDeskLaptop(THREE: typeof import("three")) {
  const group = new THREE.Group();
  const shell = new THREE.MeshStandardMaterial({color: 0x9aa8af, roughness: 0.42, metalness: 0.36});
  const dark = new THREE.MeshStandardMaterial({color: 0x101820, roughness: 0.5, metalness: 0.16});
  const keyboard = new THREE.MeshStandardMaterial({color: 0x0b1015, roughness: 0.68, metalness: 0.08});

  const base = new THREE.Mesh(new THREE.BoxGeometry(3.0, 0.08, 1.76), shell);
  base.position.y = 0.03;
  base.castShadow = true;
  base.receiveShadow = true;
  group.add(base);

  const screen = new THREE.Mesh(new THREE.BoxGeometry(2.92, 1.62, 0.08), dark);
  screen.position.set(0, 0.88, -0.72);
  screen.rotation.x = 0.12;
  screen.castShadow = true;
  group.add(screen);

  const display = new THREE.Mesh(new THREE.PlaneGeometry(2.48, 1.28), new THREE.MeshBasicMaterial({color: 0x1a2a35}));
  display.position.set(0, 0.88, -0.67);
  display.rotation.x = 0.12;
  group.add(display);

  const trackpad = new THREE.Mesh(new THREE.BoxGeometry(0.72, 0.012, 0.42), new THREE.MeshStandardMaterial({color: 0x5d6d77, roughness: 0.5, metalness: 0.2}));
  trackpad.position.set(0, 0.09, 0.42);
  group.add(trackpad);

  for (let row = 0; row < 4; row += 1) {
    for (let col = 0; col < 14; col += 1) {
      const key = new THREE.Mesh(new THREE.BoxGeometry(0.112, 0.02, 0.065), keyboard);
      key.position.set(-0.8 + col * 0.123, 0.1, -0.06 - row * 0.092);
      group.add(key);
    }
  }

  group.name = "desk-laptop";
  group.position.set(-3.32, DESK_SURFACE_Y + 0.06, -0.92);
  group.rotation.set(0, 0.56, 0);
  group.scale.setScalar(1.08);
  return group;
}

function createLaptopScreen(
  CSS3DObject: typeof import("three/examples/jsm/renderers/CSS3DRenderer.js").CSS3DObject,
  options: {
    costs: LaptopCostState;
    error: string | null;
    musicMuted: boolean;
    onApproveArtifact: (artifact: GameLessonArtifact) => void;
    onCreateRun: () => void;
    onResetProgress: () => void;
    onRunStage: (stage: GameLessonStage, options?: {force?: boolean}) => void;
    onSignIn: (formData: FormData) => Promise<void>;
    onSignOut: () => Promise<void>;
    onMusicChange: (selectedMusicId: MusicOptionId) => void;
    onMusicMutedChange: (muted: boolean) => void;
    onMusicVolumeChange: (volume: number) => void;
    onTabChange: (tab: LaptopTab) => void;
    origin: string;
    pipeline: LaptopPipelineState;
    musicVolume: number;
    selectedMusicId: MusicOptionId;
    tab: LaptopTab;
    user: CurrentUser | null;
  }
) {
  const screen = document.createElement("div");
  screen.style.width = "1068px";
  screen.style.height = "600px";
  screen.style.overflow = "hidden";
  screen.style.borderRadius = "14px";
  screen.style.background = "#071018";
  screen.style.boxShadow = "inset 0 0 36px rgba(35, 220, 255, 0.16)";
  screen.style.color = "#d9fff5";
  screen.style.fontFamily = "ui-monospace, SFMono-Regular, Menlo, monospace";
  screen.style.position = "relative";

  const appRoot = document.createElement("div");
  appRoot.style.height = "100%";
  appRoot.style.width = "100%";

  const screenStyle = document.createElement("style");
  screenStyle.textContent = "@keyframes game-pipeline-spin { to { transform: rotate(360deg); } }";
  screen.append(screenStyle);

  const musicDock = document.createElement("div");
  musicDock.style.position = "absolute";
  musicDock.style.left = "-9999px";
  musicDock.style.top = "-9999px";
  musicDock.style.width = "1px";
  musicDock.style.height = "1px";
  musicDock.style.overflow = "hidden";
  musicDock.style.opacity = "0";
  musicDock.style.pointerEvents = "none";

  const iframe = document.createElement("iframe");
  iframe.src = musicEmbedUrl(options.selectedMusicId, options.musicMuted, options.origin);
  iframe.title = "Study music livestream";
  iframe.allow = "accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share";
  iframe.allowFullscreen = true;
  iframe.referrerPolicy = "strict-origin-when-cross-origin";
  iframe.style.width = "100%";
  iframe.style.height = "100%";
  iframe.style.border = "0";
  iframe.style.display = "block";

  let currentUser = options.user;
  let currentTab = options.tab;
  let currentError = options.error;
  let currentMusicId = options.selectedMusicId;
  let currentMusicMuted = options.musicMuted;
  let currentMusicVolume = options.musicVolume;
  let currentPipeline = options.pipeline;
  let currentCosts = options.costs;
  let loading = false;

  function postMusicCommand(command: "mute" | "playVideo" | "setVolume" | "unMute", args: unknown[] = []) {
    iframe.contentWindow?.postMessage(JSON.stringify({event: "command", func: command, args}), "https://www.youtube.com");
  }

  function applyMusicPlaybackState() {
    postMusicCommand("playVideo");
    postMusicCommand(currentMusicMuted ? "mute" : "unMute");
    postMusicCommand("setVolume", [currentMusicVolume]);
  }

  function refreshMusicSource() {
    iframe.src = musicEmbedUrl(currentMusicId, currentMusicMuted, options.origin);
  }

  function keepMusicMounted() {
    if (iframe.parentElement !== musicDock) {
      musicDock.append(iframe);
    }
  }

  iframe.addEventListener("load", () => {
    window.setTimeout(applyMusicPlaybackState, 250);
  });
  screen.append(appRoot, musicDock);
  keepMusicMounted();

  function render() {
    keepMusicMounted();
    appRoot.replaceChildren();
    if (!currentUser) {
      appRoot.append(renderLaptopLogin({error: currentError, loading, onSignIn: options.onSignIn}));
      return;
    }
    appRoot.append(renderLaptopBrowser({
      iframe,
      musicMuted: currentMusicMuted,
      musicVolume: currentMusicVolume,
      onSignOut: options.onSignOut,
      onApproveArtifact: options.onApproveArtifact,
      onCreateRun: options.onCreateRun,
      onRunStage: options.onRunStage,
      onResetProgress: options.onResetProgress,
      onMusicChange: (selectedMusicId) => {
        currentMusicId = selectedMusicId;
        refreshMusicSource();
        render();
        options.onMusicChange(selectedMusicId);
      },
      onMusicMutedChange: (muted) => {
        currentMusicMuted = muted;
        postMusicCommand(muted ? "mute" : "unMute");
        postMusicCommand("playVideo");
        render();
        options.onMusicMutedChange(muted);
      },
      onMusicVolumeChange: (volume) => {
        currentMusicVolume = clampMusicVolume(volume);
        postMusicCommand("setVolume", [currentMusicVolume]);
        render();
        options.onMusicVolumeChange(currentMusicVolume);
      },
      onTabChange: (tab) => {
        currentTab = tab;
        render();
        options.onTabChange(tab);
      },
      selectedMusicId: currentMusicId,
      pipeline: currentPipeline,
      costs: currentCosts,
      tab: currentTab,
      user: currentUser
    }));
    applyMusicPlaybackState();
  }
  render();

  const object = new CSS3DObject(screen);
  object.name = "laptop-lofi-girl-embed";
  object.position.set(0, 0.88, -0.668);
  object.rotation.x = 0.12;
  object.scale.setScalar(0.0025);
  return {
    api: {
      setError(message: string | null) {
        currentError = message;
        render();
      },
      setLoading(value: boolean) {
        loading = value;
        render();
      },
      setMusicState(state: MusicState) {
        const musicSourceChanged = currentMusicId !== state.selectedMusicId;
        currentMusicId = state.selectedMusicId;
        currentMusicMuted = state.muted;
        currentMusicVolume = clampMusicVolume(state.volume);
        if (musicSourceChanged) {
          refreshMusicSource();
        } else {
          applyMusicPlaybackState();
        }
        render();
      },
      setPipelineState(state: LaptopPipelineState) {
        currentPipeline = state;
        render();
      },
      setCostState(state: LaptopCostState) {
        currentCosts = state;
        render();
      },
      setTab(tab: LaptopTab) {
        currentTab = tab;
        render();
      },
      updateUser(user: CurrentUser | null) {
        currentUser = user;
        currentError = null;
        render();
      }
    },
    iframe,
    object
  };
}

function renderLaptopLogin({
  error,
  loading,
  onSignIn
}: {
  error: string | null;
  loading: boolean;
  onSignIn: (formData: FormData) => Promise<void>;
}) {
  const wrap = document.createElement("div");
  wrap.style.height = "100%";
  wrap.style.display = "grid";
  wrap.style.placeItems = "center";
  wrap.style.background = "linear-gradient(135deg, #071018, #0c111c 68%, #121024)";

  const form = document.createElement("form");
  form.style.width = "430px";
  form.style.display = "grid";
  form.style.gap = "18px";
  form.style.padding = "34px";
  form.style.border = "1px solid rgba(127,255,230,0.24)";
  form.style.borderRadius = "18px";
  form.style.background = "rgba(2,7,18,0.72)";
  form.style.boxShadow = "0 0 48px rgba(16,185,129,0.12)";

  const title = document.createElement("div");
  title.innerHTML = `<div style="font-size:24px;font-weight:800;letter-spacing:.04em;color:#f4fff9">quadratics login</div><div style="margin-top:8px;font-size:13px;color:rgba(217,255,245,.58)">Start a saved worksheet session.</div>`;
  form.append(title);

  const username = createLaptopInput("username", "text", "USERNAME");
  const password = createLaptopInput("password", "password", "PASSWORD");
  form.append(username.label, password.label);

  if (error) {
    const message = document.createElement("div");
    message.textContent = error;
    message.style.border = "1px solid rgba(248,113,113,0.46)";
    message.style.background = "rgba(127,29,29,0.42)";
    message.style.color = "#fecaca";
    message.style.padding = "12px 14px";
    message.style.borderRadius = "10px";
    message.style.fontSize = "12px";
    form.append(message);
  }

  const button = document.createElement("button");
  button.type = "submit";
  button.textContent = loading ? "SIGNING IN" : "SIGN IN";
  button.disabled = loading;
  button.style.border = "1px solid rgba(52,211,153,0.75)";
  button.style.background = "rgba(6,78,59,0.62)";
  button.style.color = "#a7f3d0";
  button.style.padding = "14px";
  button.style.borderRadius = "10px";
  button.style.fontWeight = "800";
  button.style.letterSpacing = ".08em";
  form.append(button);

  form.addEventListener("submit", (event) => {
    event.preventDefault();
    void onSignIn(new FormData(form));
  });

  wrap.append(form);
  return wrap;
}

function createLaptopInput(name: string, type: string, labelText: string) {
  const label = document.createElement("label");
  label.style.display = "grid";
  label.style.gap = "7px";
  const span = document.createElement("span");
  span.textContent = labelText;
  span.style.fontSize = "11px";
  span.style.color = "rgba(212,212,216,0.55)";
  span.style.letterSpacing = ".1em";
  const input = document.createElement("input");
  input.name = name;
  input.type = type;
  input.required = true;
  input.autocomplete = type === "password" ? "current-password" : "username";
  input.style.border = "1px solid rgba(63,63,70,0.9)";
  input.style.background = "#101621";
  input.style.color = "#f4f4f5";
  input.style.padding = "13px 14px";
  input.style.borderRadius = "10px";
  input.style.fontSize = "16px";
  label.append(span, input);
  return {input, label};
}

function createLaptopSectionLabel(text: string) {
  const label = document.createElement("div");
  label.textContent = text;
  label.style.fontSize = "11px";
  label.style.letterSpacing = ".22em";
  label.style.textTransform = "uppercase";
  label.style.color = "rgba(167,243,208,0.72)";
  return label;
}

function renderLaptopPipeline({
  onApproveArtifact,
  onCreateRun,
  onResetProgress,
  onRunStage,
  pipeline
}: {
  onApproveArtifact: (artifact: GameLessonArtifact) => void;
  onCreateRun: () => void;
  onResetProgress: () => void;
  onRunStage: (stage: GameLessonStage, options?: {force?: boolean}) => void;
  pipeline: LaptopPipelineState;
}) {
  const wrap = document.createElement("div");
  wrap.style.height = "100%";
  wrap.style.overflow = "auto";
  wrap.style.display = "grid";
  wrap.style.alignContent = "start";
  wrap.style.gap = "14px";
  wrap.style.border = "1px solid rgba(127,255,230,.18)";
  wrap.style.borderRadius = "16px";
  wrap.style.background = "rgba(2,7,18,0.52)";
  wrap.style.padding = "18px";

  const header = document.createElement("div");
  header.style.display = "flex";
  header.style.alignItems = "start";
  header.style.justifyContent = "space-between";
  header.style.gap = "18px";
  const copy = document.createElement("div");
  copy.innerHTML = `
    <div style="font-size:11px;letter-spacing:.22em;text-transform:uppercase;color:rgba(167,243,208,.72)">worksheet pipeline</div>
    <div style="margin-top:10px;font-size:23px;font-weight:900;color:#f4fff9">${escapeHtml(pipeline.run?.templateTitle ?? "Lesson run not started")}</div>
    <div style="margin-top:8px;max-width:610px;font-size:13px;line-height:1.55;color:rgba(212,212,216,.62)">${
      pipeline.run
        ? `Run ${escapeHtml(shortRunId(pipeline.run.id))} is ready for approval-gated worksheet generation.`
        : "Click Lesson 1 on the paper to create the signed-in worksheet run."
    }</div>
    <div style="display:inline-flex;margin-top:10px;border:1px solid rgba(52,211,153,.24);background:rgba(6,78,59,.22);border-radius:8px;padding:7px 10px;color:rgba(209,250,229,.82);font-size:10px;font-weight:900;letter-spacing:.12em;text-transform:uppercase">Voice / ${GAME_LESSON_DEFAULT_INSTRUCTOR_LABEL}</div>
    <a href="/game/lessons/volume-cubes/task-lesson.pdf" target="_blank" rel="noreferrer" style="display:inline-flex;margin-top:10px;border:1px solid rgba(103,232,249,.32);background:rgba(8,47,73,.22);border-radius:8px;padding:7px 10px;color:#cffafe;font-size:10px;font-weight:900;letter-spacing:.12em;text-transform:uppercase;text-decoration:none">Open template PDF</a>
  `;
  const actions = document.createElement("div");
  actions.style.display = "grid";
  actions.style.gap = "8px";
  const action = document.createElement("button");
  action.type = "button";
  action.textContent = pipeline.loading ? "STARTING" : pipeline.run ? "REFRESH TEMPLATE" : "CREATE RUN";
  action.disabled = pipeline.loading;
  action.style.border = "1px solid rgba(52,211,153,0.62)";
  action.style.background = "rgba(6,78,59,0.48)";
  action.style.color = "#a7f3d0";
  action.style.borderRadius = "10px";
  action.style.padding = "11px 13px";
  action.style.fontWeight = "900";
  action.style.fontSize = "11px";
  action.style.letterSpacing = ".08em";
  action.addEventListener("pointerdown", (event) => event.stopPropagation());
  action.addEventListener("click", (event) => {
    event.preventDefault();
    event.stopPropagation();
    onCreateRun();
  });
  const resetAction = document.createElement("button");
  resetAction.type = "button";
  resetAction.textContent = "RESET PROGRESS";
  resetAction.disabled = pipeline.loading;
  resetAction.style.border = "1px solid rgba(252,211,77,0.34)";
  resetAction.style.background = "rgba(113,63,18,0.20)";
  resetAction.style.color = "#fde68a";
  resetAction.style.borderRadius = "10px";
  resetAction.style.padding = "11px 13px";
  resetAction.style.fontWeight = "900";
  resetAction.style.fontSize = "11px";
  resetAction.style.letterSpacing = ".08em";
  resetAction.addEventListener("pointerdown", (event) => event.stopPropagation());
  resetAction.addEventListener("click", (event) => {
    event.preventDefault();
    event.stopPropagation();
    onResetProgress();
  });
  actions.append(action, resetAction);
  header.append(copy, actions);
  wrap.append(header);

  if (pipeline.error) {
    const error = document.createElement("div");
    error.textContent = pipeline.error;
    error.style.border = "1px solid rgba(248,113,113,0.42)";
    error.style.background = "rgba(127,29,29,0.36)";
    error.style.color = "#fecaca";
    error.style.borderRadius = "10px";
    error.style.padding = "10px 12px";
    error.style.fontSize = "12px";
    wrap.append(error);
  }

  const grid = document.createElement("div");
  grid.style.display = "grid";
  grid.style.gap = "12px";
  for (const {label, stage} of GAME_LESSON_STAGES) {
    const artifact = artifactForStage(pipeline.run, stage);
    const dependencyMessage = pipelineDependencyMessage(pipeline.run, stage);
    const palette = stagePalette(stage);
    const previewRows = artifactPreviewRows(artifact, stage);
    const previewText = artifactPreviewText(artifact, stage);
    const card = document.createElement("div");
    card.style.border = `1px solid ${palette.border}`;
    card.style.background = `linear-gradient(90deg, ${palette.glow}, rgba(2,7,18,0.55))`;
    card.style.borderRadius = "12px";
    card.style.padding = "14px";
    const status = artifact?.status ?? (stage === "template" ? "ready" : "waiting");
    const details = gameStageDetails[stage];
    const isRunning = pipeline.loadingStage === stage || artifact?.status === "running";
    card.innerHTML = `
      <div style="display:flex;justify-content:space-between;gap:18px;align-items:flex-start">
        <div>
          <div style="display:flex;align-items:center;gap:8px">
            <span title="${escapeHtml(`${details.summary}\n\nInputs: ${details.inputs}\n\nGuardrails: ${details.guardrails}\n\nCost: ${details.cost}`)}" style="display:inline-flex;width:15px;height:15px;align-items:center;justify-content:center;border:1px solid rgba(113,113,122,.8);border-radius:999px;color:rgba(161,161,170,.9);font-size:10px;font-family:monospace">i</span>
            <div style="font-size:14px;letter-spacing:.08em;text-transform:uppercase;color:${palette.text};font-weight:900">${escapeHtml(label)}</div>
          </div>
          <div style="margin-top:7px;font-size:11px;letter-spacing:.08em;text-transform:uppercase;color:${statusColor(artifact?.status)}">${escapeHtml(gameStageMetaLine(artifact, status))}</div>
        </div>
      </div>
      ${
        previewRows.length > 0
          ? `<div style="margin-top:13px;display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px">${previewRows.map((row) => `<div style="border:1px solid rgba(255,255,255,.1);background:rgba(0,0,0,.22);border-radius:8px;padding:8px 9px"><div style="font-size:9px;letter-spacing:.1em;text-transform:uppercase;color:rgba(161,161,170,.7)">${escapeHtml(row.label)}</div><div style="margin-top:5px;font-size:12px;font-weight:800;color:#f4f4f5">${escapeHtml(row.value)}</div></div>`).join("")}</div>`
          : ""
      }
      ${previewText ? `<div style="margin-top:10px;font-size:11px;line-height:1.48;color:rgba(212,212,216,.72)">${escapeHtml(previewText)}</div>` : ""}
      ${
        artifact?.errorMessage
          ? `<div style="margin-top:8px;font-size:11px;line-height:1.45;color:rgba(254,202,202,.84)">${escapeHtml(artifact.errorMessage)}</div>`
          : ""
      }
      ${
        dependencyMessage
          ? `<div style="margin-top:8px;font-size:11px;line-height:1.45;color:rgba(253,230,138,.72)">${escapeHtml(dependencyMessage)}</div>`
          : ""
      }
      ${
        artifact?.status === "completed" && stage === "interactive_bundle"
          ? `<div style="margin-top:8px;font-size:11px;line-height:1.45;color:rgba(187,247,208,.78)">Paper is now rendering this interactive bundle.</div>`
          : ""
      }
    `;
    const controls = document.createElement("div");
    controls.style.display = "flex";
    controls.style.alignItems = "center";
    controls.style.gap = "8px";
    controls.style.marginTop = "13px";
    if (artifact?.status === "stale") {
      const staleBadge = document.createElement("span");
      staleBadge.textContent = "STALE";
      staleBadge.style.border = "1px solid rgba(251,191,36,.42)";
      staleBadge.style.borderRadius = "7px";
      staleBadge.style.padding = "5px 7px";
      staleBadge.style.color = "#fde68a";
      staleBadge.style.fontSize = "9px";
      staleBadge.style.fontFamily = "monospace";
      staleBadge.style.fontWeight = "800";
      controls.append(staleBadge);
    }
    if (artifact?.status === "failed" || artifact?.status === "rejected") {
      const failedBadge = document.createElement("span");
      failedBadge.textContent = "FAILED";
      failedBadge.style.border = "1px solid rgba(248,113,113,.52)";
      failedBadge.style.borderRadius = "7px";
      failedBadge.style.padding = "5px 7px";
      failedBadge.style.color = "#fecaca";
      failedBadge.style.fontSize = "9px";
      failedBadge.style.fontFamily = "monospace";
      failedBadge.style.fontWeight = "800";
      controls.append(failedBadge);
    }
    if (isRunning) {
      const spinner = document.createElement("span");
      spinner.innerHTML = `<svg aria-label="Loading" viewBox="0 0 24 24" style="display:block;width:16px;height:16px;animation:game-pipeline-spin .8s linear infinite;color:#6ee7b7" fill="none"><circle cx="12" cy="12" r="9" stroke="currentColor" stroke-width="3" opacity=".25"></circle><path d="M21 12a9 9 0 0 0-9-9" stroke="currentColor" stroke-linecap="round" stroke-width="3"></path></svg>`;
      controls.append(spinner);
    }
    const runButton = document.createElement("button");
    runButton.type = "button";
    runButton.title = artifact ? `Regenerate ${label}` : `Run ${label}`;
    runButton.setAttribute("aria-label", runButton.title);
    runButton.innerHTML = artifact
      ? `<svg aria-hidden="true" viewBox="0 0 24 24" style="width:16px;height:16px" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2"><path d="M21 12a9 9 0 1 1-2.6-6.4"></path><path d="M21 3v6h-6"></path><path d="m10 8 6 4-6 4V8z"></path></svg>`
      : `<svg aria-hidden="true" viewBox="0 0 24 24" style="width:16px;height:16px" fill="currentColor"><path d="M8 5v14l11-7z"></path></svg>`;
    runButton.disabled = pipeline.loading || isRunning || Boolean(dependencyMessage);
    runButton.style.display = "inline-flex";
    runButton.style.width = "32px";
    runButton.style.height = "32px";
    runButton.style.alignItems = "center";
    runButton.style.justifyContent = "center";
    runButton.style.border = "1px solid rgba(63,63,70,.95)";
    runButton.style.background = "transparent";
    runButton.style.color = "#d4d4d8";
    runButton.style.borderRadius = "8px";
    runButton.addEventListener("pointerdown", (event) => event.stopPropagation());
    runButton.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      onRunStage(stage, {force: Boolean(artifact)});
    });
    controls.append(runButton);
    if (artifact?.status === "awaiting_approval") {
      const approveButton = document.createElement("button");
      approveButton.type = "button";
      approveButton.textContent = "APPROVE";
      approveButton.disabled = pipeline.loading;
      approveButton.style.border = "1px solid rgba(52,211,153,0.46)";
      approveButton.style.background = "rgba(6,78,59,0.28)";
      approveButton.style.color = "#bbf7d0";
      approveButton.style.borderRadius = "8px";
      approveButton.style.padding = "7px 9px";
      approveButton.style.fontSize = "10px";
      approveButton.style.fontWeight = "900";
      approveButton.style.letterSpacing = ".1em";
      approveButton.addEventListener("pointerdown", (event) => event.stopPropagation());
      approveButton.addEventListener("click", (event) => {
        event.preventDefault();
        event.stopPropagation();
        onApproveArtifact(artifact);
      });
      controls.append(approveButton);
    }
    card.append(controls);
    grid.append(card);
  }
  wrap.append(grid);
  return wrap;
}

function renderLaptopCosts(pipeline: LaptopPipelineState, costs: LaptopCostState) {
  const paidStages = new Set<GameLessonStage>(["section_script", "speech_markup", "narration"]);
  const userTotal = costs.summary?.userTotalCostUsd ?? 0;
  const globalAverage = costs.summary?.globalAverageCostPerLessonUsd ?? 0;
  const stageRows = GAME_LESSON_STAGES.map(({stage, label}) => {
    const artifact = artifactForStage(pipeline.run, stage);
    const paid = paidStages.has(stage);
    const status = artifact?.status ?? "pending";
    const matchingBreakdown = costs.summary?.userBreakdown.find((item) => item.stage === stage);
    return `
      <div style="display:grid;grid-template-columns:1fr auto auto;gap:10px;align-items:center;border-top:1px solid rgba(63,63,70,.54);padding:10px 0">
        <div>
          <div style="font-size:12px;font-weight:900;color:#f4fff9">${escapeHtml(label)}</div>
          <div style="margin-top:3px;font-size:10px;letter-spacing:.12em;text-transform:uppercase;color:rgba(161,161,170,.72)">${paid ? "paid-provider stage" : "deterministic stage"}</div>
        </div>
        <div style="font-size:10px;letter-spacing:.14em;text-transform:uppercase;color:${status === "approved" || status === "completed" ? "#a7f3d0" : "#a1a1aa"}">${escapeHtml(status)}</div>
        <div style="font-size:12px;font-weight:900;color:${paid ? "#fde68a" : "#a7f3d0"}">${paid ? formatUsd(matchingBreakdown?.costUsd ?? 0) : "$0.00"}</div>
      </div>
    `;
  }).join("");
  const eventRows = costs.events.length > 0
    ? costs.events.slice(0, 8).map((event) => `
      <div style="display:grid;grid-template-columns:1fr auto;gap:10px;border-top:1px solid rgba(63,63,70,.5);padding:10px 0">
        <div style="min-width:0">
          <div style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:11px;font-weight:900;text-transform:uppercase;color:#f4fff9">${escapeHtml(event.provider)} / ${escapeHtml(event.stage)}</div>
          <div style="margin-top:3px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:10px;letter-spacing:.1em;text-transform:uppercase;color:rgba(161,161,170,.72)">${escapeHtml(event.model ?? "provider model")} / ${formatQuantity(event.quantity)} ${escapeHtml(event.unitType)}</div>
        </div>
        <div style="font-size:12px;font-weight:900;color:#a7f3d0">${formatUsd(event.totalCostUsd)}</div>
      </div>
    `).join("")
    : `<div style="border-top:1px dashed rgba(63,63,70,.7);padding:14px 0;color:rgba(161,161,170,.72);font-size:12px">${costs.loading ? "Loading game usage events..." : "No paid game pipeline calls recorded yet."}</div>`;
  const wrap = document.createElement("div");
  wrap.style.height = "100%";
  wrap.style.display = "grid";
  wrap.style.alignContent = "start";
  wrap.style.gap = "16px";
  wrap.style.border = "1px solid rgba(103,232,249,.17)";
  wrap.style.borderRadius = "16px";
  wrap.style.background = "rgba(2,7,18,0.52)";
  wrap.style.padding = "20px";
  wrap.innerHTML = `
    <div>
      <div style="font-size:11px;letter-spacing:.22em;text-transform:uppercase;color:rgba(165,243,252,.7)">game costs</div>
      <div style="margin-top:10px;font-size:25px;font-weight:900;color:#f4fff9">${formatUsd(userTotal)}</div>
      <div style="margin-top:8px;max-width:760px;font-size:13px;line-height:1.55;color:rgba(212,212,216,.62)">Game worksheet costs are tracked separately from quadratic video generation. Provider calls from script, speech markup, and narration stages are included in this game-only ledger.</div>
    </div>
    ${costs.error ? `<div style="border:1px solid rgba(248,113,113,.42);background:rgba(127,29,29,.34);border-radius:9px;padding:10px 12px;color:#fecaca;font-size:12px">${escapeHtml(costs.error)}</div>` : ""}
    <div style="display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:10px">
      <div style="border:1px solid rgba(63,63,70,.86);background:rgba(2,7,18,.55);border-radius:10px;padding:12px"><div style="font-size:10px;letter-spacing:.1em;text-transform:uppercase;color:rgba(161,161,170,.7)">Current run</div><div style="margin-top:12px;font-size:13px;font-weight:800;color:#d4d4d8">${escapeHtml(pipeline.run ? shortRunId(pipeline.run.id) : "none")}</div></div>
      <div style="border:1px solid rgba(63,63,70,.86);background:rgba(2,7,18,.55);border-radius:10px;padding:12px"><div style="font-size:10px;letter-spacing:.1em;text-transform:uppercase;color:rgba(161,161,170,.7)">Avg / lesson</div><div style="margin-top:12px;font-size:13px;font-weight:800;color:#d4d4d8">${formatUsd(globalAverage)}</div></div>
      <div style="border:1px solid rgba(63,63,70,.86);background:rgba(2,7,18,.55);border-radius:10px;padding:12px"><div style="font-size:10px;letter-spacing:.1em;text-transform:uppercase;color:rgba(161,161,170,.7)">Paid events</div><div style="margin-top:12px;font-size:13px;font-weight:800;color:#d4d4d8">${costs.loading ? "loading" : `${costs.events.length} recorded`}</div></div>
    </div>
    <div style="border:1px solid rgba(63,63,70,.76);border-radius:12px;background:rgba(3,7,18,.42);padding:4px 14px">
      <div style="padding:10px 0;font-size:10px;letter-spacing:.18em;text-transform:uppercase;color:rgba(165,243,252,.56)">recent calls</div>
      ${eventRows}
    </div>
    <div style="border:1px solid rgba(63,63,70,.76);border-radius:12px;background:rgba(3,7,18,.42);padding:4px 14px">${stageRows}</div>
  `;
  return wrap;
}

function renderLaptopBrowser({
  costs,
  iframe,
  musicMuted,
  musicVolume,
  onApproveArtifact,
  onCreateRun,
  onMusicChange,
  onMusicMutedChange,
  onMusicVolumeChange,
  onResetProgress,
  onRunStage,
  onSignOut,
  onTabChange,
  pipeline,
  selectedMusicId,
  tab,
  user
}: {
  costs: LaptopCostState;
  iframe: HTMLIFrameElement;
  musicMuted: boolean;
  musicVolume: number;
  onApproveArtifact: (artifact: GameLessonArtifact) => void;
  onCreateRun: () => void;
  onMusicChange: (selectedMusicId: MusicOptionId) => void;
  onMusicMutedChange: (muted: boolean) => void;
  onMusicVolumeChange: (volume: number) => void;
  onResetProgress: () => void;
  onRunStage: (stage: GameLessonStage, options?: {force?: boolean}) => void;
  onSignOut: () => Promise<void>;
  onTabChange: (tab: LaptopTab) => void;
  pipeline: LaptopPipelineState;
  selectedMusicId: MusicOptionId;
  tab: LaptopTab;
  user: CurrentUser;
}) {
  const wrap = document.createElement("div");
  wrap.style.height = "100%";
  wrap.style.display = "grid";
  wrap.style.gridTemplateRows = "58px 1fr";
  wrap.style.background = "#070b12";

  const tabs = document.createElement("div");
  tabs.style.display = "flex";
  tabs.style.alignItems = "end";
  tabs.style.gap = "7px";
  tabs.style.padding = "10px 12px 0";
  tabs.style.borderBottom = "1px solid rgba(63,63,70,0.7)";
  tabs.style.background = "#111318";
  for (const item of [
    ["demo", "◼ Demo"],
    ["pipeline", "▣ Pipeline"],
    ["costs", "$ Costs"],
    ["music", "▶ Music"],
    ["settings", "⚙ Settings"]
  ] as Array<[LaptopTab, string]>) {
    const button = document.createElement("button");
    button.textContent = item[1];
    button.type = "button";
    button.style.height = "38px";
    button.style.padding = "0 20px";
    button.style.border = "1px solid rgba(63,63,70,0.86)";
    button.style.borderBottom = tab === item[0] ? "1px solid #071018" : "1px solid rgba(63,63,70,0.86)";
    button.style.borderRadius = "11px 11px 0 0";
    button.style.background = tab === item[0] ? "#071018" : "#191b22";
    button.style.color = tab === item[0] ? "#a7f3d0" : "#a1a1aa";
    button.style.fontWeight = "800";
    button.style.fontSize = "13px";
    button.addEventListener("pointerdown", (event) => {
      event.stopPropagation();
    });
    button.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      onTabChange(item[0]);
    });
    tabs.append(button);
  }
  wrap.append(tabs);

  const body = document.createElement("div");
  body.style.minHeight = "0";
  body.style.padding = "20px";
  body.style.background = "linear-gradient(135deg,#071018,#090d14)";
  if (tab === "music") {
    body.style.display = "grid";
    body.style.gridTemplateColumns = "260px 1fr";
    body.style.gap = "16px";
    const controls = document.createElement("div");
    controls.style.display = "grid";
    controls.style.alignContent = "start";
    controls.style.gap = "10px";
    controls.append(createLaptopSectionLabel("Music"));
    for (const option of MUSIC_OPTIONS) {
      const button = document.createElement("button");
      button.type = "button";
      button.textContent = `${option.label} / ${option.subtitle}`;
      button.style.border = `1px solid ${selectedMusicId === option.id ? "rgba(52,211,153,0.74)" : "rgba(63,63,70,0.9)"}`;
      button.style.background = selectedMusicId === option.id ? "rgba(6,78,59,0.45)" : "rgba(2,7,18,0.58)";
      button.style.color = selectedMusicId === option.id ? "#a7f3d0" : "#d4d4d8";
      button.style.borderRadius = "10px";
      button.style.padding = "12px";
      button.style.fontWeight = "800";
      button.style.textAlign = "left";
      button.addEventListener("pointerdown", (event) => event.stopPropagation());
      button.addEventListener("click", (event) => {
        event.preventDefault();
        event.stopPropagation();
        onMusicChange(option.id);
      });
      controls.append(button);
    }
    const mute = document.createElement("button");
    mute.type = "button";
    mute.textContent = musicMuted ? "MUTED" : "MUTE";
    mute.style.border = "1px solid rgba(34,211,238,0.48)";
    mute.style.background = musicMuted ? "rgba(24,24,27,0.8)" : "rgba(8,47,73,0.48)";
    mute.style.color = musicMuted ? "#a1a1aa" : "#cffafe";
    mute.style.borderRadius = "10px";
    mute.style.padding = "12px";
    mute.style.fontWeight = "900";
    mute.addEventListener("pointerdown", (event) => event.stopPropagation());
    mute.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      onMusicMutedChange(!musicMuted);
    });
    controls.append(mute);
    const volumeLabel = document.createElement("label");
    volumeLabel.style.display = "grid";
    volumeLabel.style.gap = "8px";
    volumeLabel.style.marginTop = "2px";
    const volumeText = document.createElement("span");
    volumeText.textContent = `VOLUME / ${musicVolume}%`;
    volumeText.style.color = "rgba(207,250,254,0.64)";
    volumeText.style.fontSize = "11px";
    volumeText.style.fontWeight = "900";
    volumeText.style.letterSpacing = "0.14em";
    const volumeInput = document.createElement("input");
    volumeInput.type = "range";
    volumeInput.min = "0";
    volumeInput.max = "100";
    volumeInput.step = "1";
    volumeInput.value = String(musicVolume);
    volumeInput.style.accentColor = "#67e8f9";
    volumeInput.addEventListener("pointerdown", (event) => event.stopPropagation());
    volumeInput.addEventListener("input", (event) => {
      event.stopPropagation();
      onMusicVolumeChange(Number((event.currentTarget as HTMLInputElement).value));
    });
    volumeLabel.append(volumeText, volumeInput);
    controls.append(volumeLabel);
    const player = document.createElement("div");
    player.style.overflow = "hidden";
    player.style.border = "1px solid rgba(127,255,230,0.18)";
    player.style.borderRadius = "14px";
    player.append(iframe);
    body.append(controls, player);
  } else if (tab === "pipeline") {
    body.append(renderLaptopPipeline({onApproveArtifact, onCreateRun, onResetProgress, onRunStage, pipeline}));
  } else if (tab === "costs") {
    body.append(renderLaptopCosts(pipeline, costs));
  } else if (tab === "settings") {
    body.innerHTML = `<div style="display:grid;gap:18px;max-width:520px"><div><div style="font-size:24px;font-weight:900;color:#f4fff9">Settings</div><div style="margin-top:6px;color:rgba(212,212,216,.62)">Signed in as ${escapeHtml(accountDisplayName(user))}</div></div></div>`;
    const button = document.createElement("button");
    button.textContent = "SIGN OUT";
    button.type = "button";
    button.style.marginTop = "24px";
    button.style.border = "1px solid rgba(248,113,113,0.6)";
    button.style.background = "rgba(127,29,29,0.45)";
    button.style.color = "#fecaca";
    button.style.padding = "14px 18px";
    button.style.borderRadius = "10px";
    button.style.fontWeight = "900";
    button.addEventListener("pointerdown", (event) => {
      event.stopPropagation();
    });
    button.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      void onSignOut();
    });
    body.append(button);
  } else {
    body.innerHTML = `<div style="height:100%;display:grid;place-items:center;border:1px dashed rgba(127,255,230,.25);border-radius:16px;color:rgba(217,255,245,.72)"><div style="text-align:center"><div style="font-size:22px;font-weight:900;color:#f4fff9">Demo video slot</div><div style="margin-top:10px;font-size:13px;color:rgba(212,212,216,.58)">Loom embed placeholder</div></div></div>`;
  }
  wrap.append(body);
  return wrap;
}

function formatSceneTransform(name: SceneTunableName, object: Object3D) {
  const position = [object.position.x, object.position.y, object.position.z].map((value) => value.toFixed(3)).join(", ");
  const rotation = [object.rotation.x, object.rotation.y, object.rotation.z].map((value) => value.toFixed(3)).join(", ");
  const scale = [object.scale.x, object.scale.y, object.scale.z].map((value) => value.toFixed(3)).join(", ");
  return `${name}
position.set(${position})
rotation.set(${rotation})
scale.set(${scale})`;
}

function createLeatherTexture(THREE: typeof import("three")) {
  const canvas = document.createElement("canvas");
  canvas.width = 512;
  canvas.height = 512;
  const context = canvas.getContext("2d");
  if (context) {
    context.fillStyle = "#191917";
    context.fillRect(0, 0, canvas.width, canvas.height);
    for (let index = 0; index < 7800; index += 1) {
      const shade = 28 + Math.floor(Math.random() * 32);
      context.fillStyle = `rgba(${shade}, ${shade}, ${shade - 3}, ${0.12 + Math.random() * 0.18})`;
      context.fillRect(Math.random() * canvas.width, Math.random() * canvas.height, 0.7 + Math.random() * 1.7, 0.7 + Math.random() * 1.7);
    }
    context.strokeStyle = "rgba(255,255,255,0.035)";
    context.lineWidth = 1;
    for (let index = 0; index < 95; index += 1) {
      const y = Math.random() * canvas.height;
      context.beginPath();
      context.moveTo(Math.random() * canvas.width, y);
      context.quadraticCurveTo(Math.random() * canvas.width, y + Math.random() * 18 - 9, Math.random() * canvas.width, y + Math.random() * 28 - 14);
      context.stroke();
    }
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(5, 4);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.needsUpdate = true;
  return texture;
}

function createConcreteTexture(THREE: typeof import("three")) {
  const canvas = document.createElement("canvas");
  canvas.width = 768;
  canvas.height = 768;
  const context = canvas.getContext("2d");
  if (context) {
    context.fillStyle = "#777a7c";
    context.fillRect(0, 0, canvas.width, canvas.height);
    for (let index = 0; index < 14_000; index += 1) {
      const shade = 86 + Math.floor(Math.random() * 68);
      context.fillStyle = `rgba(${shade}, ${shade}, ${shade}, ${0.08 + Math.random() * 0.16})`;
      context.fillRect(Math.random() * canvas.width, Math.random() * canvas.height, 1 + Math.random() * 2.5, 1 + Math.random() * 2.5);
    }
    context.strokeStyle = "rgba(40, 42, 45, 0.18)";
    context.lineWidth = 2;
    for (let index = 0; index < 18; index += 1) {
      context.beginPath();
      const y = Math.random() * canvas.height;
      context.moveTo(0, y);
      for (let x = 0; x <= canvas.width; x += 96) {
        context.lineTo(x, y + Math.sin(index + x * 0.01) * 10);
      }
      context.stroke();
    }
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(3, 3);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.needsUpdate = true;
  return texture;
}

function createWoodTexture(THREE: typeof import("three"), baseColor: number, grainColor: number) {
  const canvas = document.createElement("canvas");
  canvas.width = 768;
  canvas.height = 384;
  const context = canvas.getContext("2d");
  if (context) {
    const base = `#${baseColor.toString(16).padStart(6, "0")}`;
    const grain = `#${grainColor.toString(16).padStart(6, "0")}`;
    const gradient = context.createLinearGradient(0, 0, canvas.width, canvas.height);
    gradient.addColorStop(0, base);
    gradient.addColorStop(0.55, "#a86432");
    gradient.addColorStop(1, "#d5904d");
    context.fillStyle = gradient;
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.strokeStyle = grain;
    context.lineWidth = 3;
    for (let index = 0; index < 30; index += 1) {
      const y = 18 + index * 13 + Math.random() * 6;
      context.globalAlpha = 0.16 + Math.random() * 0.1;
      context.beginPath();
      context.moveTo(0, y);
      for (let x = 0; x <= canvas.width; x += 72) {
        context.lineTo(x, y + Math.sin(index * 0.7 + x * 0.018) * 11);
      }
      context.stroke();
    }
    context.globalAlpha = 1;
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(2, 2);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.needsUpdate = true;
  return texture;
}

function createGlobe(THREE: typeof import("three")) {
  const group = new THREE.Group();
  const standMaterial = new THREE.MeshStandardMaterial({color: 0xb4a27a, roughness: 0.36, metalness: 0.52});
  const globeTexture = createGlobeTexture(THREE);
  const globeMaterial = new THREE.MeshStandardMaterial({map: globeTexture, roughness: 0.58, metalness: 0.02});

  const sphere = new THREE.Mesh(new THREE.SphereGeometry(0.42, 32, 20), globeMaterial);
  sphere.position.y = 0.62;
  sphere.rotation.set(0.16, -0.72, -0.18);
  sphere.castShadow = true;
  group.add(sphere);

  const ring = new THREE.Mesh(new THREE.TorusGeometry(0.49, 0.025, 10, 48), standMaterial);
  ring.position.y = 0.62;
  ring.rotation.set(Math.PI / 2.35, 0.16, -0.35);
  ring.castShadow = true;
  group.add(ring);

  const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 0.62, 12), standMaterial);
  stem.position.y = 0.26;
  stem.castShadow = true;
  group.add(stem);

  const base = new THREE.Mesh(new THREE.CylinderGeometry(0.34, 0.42, 0.07, 28), standMaterial);
  base.position.y = 0.035;
  base.castShadow = true;
  group.add(base);

  return group;
}

function createGlobeTexture(THREE: typeof import("three")) {
  const canvas = document.createElement("canvas");
  canvas.width = 768;
  canvas.height = 384;
  const context = canvas.getContext("2d");
  if (context) {
    const ocean = context.createLinearGradient(0, 0, canvas.width, canvas.height);
    ocean.addColorStop(0, "#173a5f");
    ocean.addColorStop(0.5, "#1f7aa5");
    ocean.addColorStop(1, "#0f314e");
    context.fillStyle = ocean;
    context.fillRect(0, 0, canvas.width, canvas.height);

    context.strokeStyle = "rgba(205,236,255,0.18)";
    context.lineWidth = 1.5;
    for (let x = 0; x <= canvas.width; x += 64) {
      context.beginPath();
      context.moveTo(x, 0);
      context.lineTo(x, canvas.height);
      context.stroke();
    }
    for (let y = 48; y < canvas.height; y += 48) {
      context.beginPath();
      context.moveTo(0, y);
      context.lineTo(canvas.width, y);
      context.stroke();
    }

    const continents = [
      {x: 92, y: 96, points: [[0, 20], [44, -26], [100, -14], [130, 32], [92, 82], [28, 74]]},
      {x: 180, y: 190, points: [[0, 0], [42, -34], [88, -6], [76, 60], [36, 96], [-10, 60]]},
      {x: 348, y: 110, points: [[0, 18], [52, -28], [130, -18], [190, 24], [170, 90], [86, 108], [22, 72]]},
      {x: 430, y: 224, points: [[0, 0], [52, -20], [96, 22], [68, 84], [18, 70]]},
      {x: 578, y: 132, points: [[0, 0], [48, -28], [118, 0], [136, 56], [88, 92], [26, 64]]},
      {x: 626, y: 258, points: [[0, 0], [54, -16], [90, 18], [74, 58], [26, 62]]}
    ];
    for (const continent of continents) {
      context.beginPath();
      context.moveTo(continent.x + continent.points[0][0], continent.y + continent.points[0][1]);
      for (const [x, y] of continent.points.slice(1)) {
        context.lineTo(continent.x + x, continent.y + y);
      }
      context.closePath();
      context.fillStyle = "#6ea45f";
      context.fill();
      context.strokeStyle = "rgba(236,218,157,0.6)";
      context.lineWidth = 4;
      context.stroke();
      context.fillStyle = "rgba(213,179,93,0.45)";
      context.fill();
    }
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.needsUpdate = true;
  return texture;
}

function createClock(THREE: typeof import("three"), clockTexture: Texture) {
  const group = new THREE.Group();
  const caseMaterial = new THREE.MeshStandardMaterial({color: 0x111827, roughness: 0.34, metalness: 0.42});
  const trimMaterial = new THREE.MeshStandardMaterial({color: 0x35f2ff, emissive: 0x0b8ea3, emissiveIntensity: 1.3, roughness: 0.22, metalness: 0.35});
  const shadowMaterial = new THREE.MeshStandardMaterial({color: 0x02040a, roughness: 0.52, metalness: 0.2});

  const body = new THREE.Mesh(new THREE.BoxGeometry(1.02, 0.54, 0.42), caseMaterial);
  body.position.set(0, 0.3, 0);
  body.rotation.x = -0.1;
  body.castShadow = true;
  group.add(body);

  const face = new THREE.Mesh(new THREE.PlaneGeometry(0.78, 0.31), new THREE.MeshBasicMaterial({map: clockTexture, transparent: true}));
  face.position.set(0, 0.34, 0.256);
  face.rotation.x = -0.1;
  group.add(face);

  const glowStrip = new THREE.Mesh(new THREE.BoxGeometry(0.82, 0.025, 0.02), trimMaterial);
  glowStrip.position.set(0, 0.055, 0.215);
  glowStrip.rotation.x = -0.1;
  group.add(glowStrip);

  const footLeft = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.08, 0.18), shadowMaterial);
  footLeft.position.set(-0.27, 0.02, 0.14);
  footLeft.rotation.z = 0.18;
  footLeft.castShadow = true;
  group.add(footLeft);

  const footRight = footLeft.clone();
  footRight.position.x = 0.27;
  footRight.rotation.z = -0.18;
  group.add(footRight);

  return group;
}

function createClockTexture(THREE: typeof import("three")) {
  const canvas = document.createElement("canvas");
  canvas.width = 512;
  canvas.height = 256;
  drawClockTexture(canvas, null);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.needsUpdate = true;
  return texture;
}

function refreshClockTexture(texture: Texture | null, pomodoro: PomodoroState | null = null) {
  if (!texture?.image || !(texture.image instanceof HTMLCanvasElement)) {
    return;
  }
  drawClockTexture(texture.image, pomodoro);
  texture.needsUpdate = true;
}

function drawClockTexture(canvas: HTMLCanvasElement, pomodoro: PomodoroState | null) {
  const context = canvas.getContext("2d");
  if (!context) {
    return;
  }
  context.clearRect(0, 0, canvas.width, canvas.height);
  context.fillStyle = "#020712";
  roundRect(context, 18, 18, canvas.width - 36, canvas.height - 36, 84);
  context.fill();
  context.strokeStyle = "rgba(56, 242, 255, 0.7)";
  context.lineWidth = 8;
  context.stroke();
  context.strokeStyle = "rgba(255, 60, 210, 0.32)";
  context.lineWidth = 4;
  context.beginPath();
  context.moveTo(58, 52);
  context.lineTo(canvas.width - 58, 52);
  context.moveTo(74, canvas.height - 50);
  context.lineTo(canvas.width - 74, canvas.height - 50);
  context.stroke();

  const timeLabel = pomodoro?.endsAt ? formatPomodoroClock(Math.max(0, pomodoro.endsAt - Date.now())) : new Intl.DateTimeFormat("en-US", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false
  }).format(new Date());

  context.font = "700 112px ui-monospace, SFMono-Regular, Menlo, monospace";
  context.textAlign = "center";
  context.textBaseline = "middle";
  context.fillStyle = "#7fffe6";
  context.shadowColor = "rgba(77,246,255,0.86)";
  context.shadowBlur = 22;
  context.fillText(timeLabel, canvas.width / 2, canvas.height / 2 + 4);
  if (pomodoro?.endsAt) {
    context.font = "700 24px ui-monospace, SFMono-Regular, Menlo, monospace";
    context.fillStyle = "#ff72cf";
    context.shadowBlur = 8;
    context.fillText("FOCUS", canvas.width / 2, canvas.height - 42);
  }
  context.shadowBlur = 0;
  context.textAlign = "start";
  context.textBaseline = "alphabetic";
}

function createCoffeeCup(THREE: typeof import("three")) {
  const group = new THREE.Group();
  const steamGroup = new THREE.Group();
  const ceramic = new THREE.MeshStandardMaterial({color: 0x15120f, roughness: 0.5, metalness: 0.1, side: THREE.DoubleSide});
  const gold = new THREE.MeshStandardMaterial({color: 0xb98437, roughness: 0.34, metalness: 0.55});
  const coffeeMaterial = new THREE.MeshStandardMaterial({color: 0x1b0a04, roughness: 0.38, metalness: 0.01});
  const coffeeHighlightMaterial = new THREE.MeshBasicMaterial({color: 0x5a2a10, transparent: true, opacity: 0.34});
  const coasterMaterial = new THREE.MeshStandardMaterial({color: 0x5b3721, roughness: 0.75});
  const steamTexture = createSteamTexture(THREE);
  const steamMaterial = new THREE.MeshBasicMaterial({
    map: steamTexture,
    color: 0xe7eef0,
    transparent: true,
    opacity: 0.22,
    depthWrite: false,
    blending: THREE.AdditiveBlending
  });

  const coaster = new THREE.Mesh(new THREE.CylinderGeometry(0.57, 0.62, 0.045, 32), coasterMaterial);
  coaster.position.y = 0.02;
  coaster.castShadow = true;
  group.add(coaster);

  const cup = new THREE.Mesh(new THREE.CylinderGeometry(0.36, 0.31, 0.45, 48, 1, true), ceramic);
  cup.position.y = 0.28;
  cup.castShadow = true;
  group.add(cup);

  const cupInner = new THREE.Mesh(
    new THREE.CylinderGeometry(0.315, 0.27, 0.4, 48, 1, true),
    new THREE.MeshStandardMaterial({color: 0x090806, roughness: 0.72, metalness: 0.02, side: THREE.DoubleSide})
  );
  cupInner.position.y = 0.285;
  group.add(cupInner);

  const rim = new THREE.Mesh(new THREE.TorusGeometry(0.36, 0.026, 10, 36), gold);
  rim.position.y = 0.51;
  rim.rotation.x = Math.PI / 2;
  rim.castShadow = true;
  group.add(rim);

  const coffee = new THREE.Mesh(new THREE.CircleGeometry(0.312, 48), coffeeMaterial);
  coffee.rotation.x = -Math.PI / 2;
  coffee.position.y = 0.472;
  group.add(coffee);

  const coffeeShine = new THREE.Mesh(new THREE.CircleGeometry(0.085, 28), coffeeHighlightMaterial);
  coffeeShine.rotation.x = -Math.PI / 2;
  coffeeShine.scale.set(1.42, 0.34, 1);
  coffeeShine.position.set(-0.08, 0.475, 0.052);
  group.add(coffeeShine);

  const handleCurve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(0.34, 0.42, 0.01),
    new THREE.Vector3(0.52, 0.41, 0.01),
    new THREE.Vector3(0.61, 0.31, 0.01),
    new THREE.Vector3(0.52, 0.21, 0.01),
    new THREE.Vector3(0.34, 0.2, 0.01)
  ]);
  const handle = new THREE.Mesh(new THREE.TubeGeometry(handleCurve, 44, 0.036, 14, false), ceramic);
  handle.castShadow = true;
  group.add(handle);

  for (const y of [0.42, 0.2]) {
    const connector = new THREE.Mesh(new THREE.CylinderGeometry(0.038, 0.038, 0.16, 16), ceramic);
    connector.position.set(0.32, y, 0.01);
    connector.rotation.z = Math.PI / 2;
    connector.castShadow = true;
    group.add(connector);
  }

  const professorMark = createMugMark(THREE);
  professorMark.position.set(0, 0.31, 0.361);
  group.add(professorMark);

  for (let index = 0; index < 7; index += 1) {
    const wispMaterial = steamMaterial.clone();
    wispMaterial.opacity = 0.1 + index * 0.018;
    const wisp = new THREE.Mesh(new THREE.PlaneGeometry(0.22 + index * 0.035, 0.84 + index * 0.08), wispMaterial);
    wisp.position.set(-0.18 + index * 0.065, 0.95 + index * 0.055, -0.03 + (index % 2) * 0.035);
    wisp.rotation.set(-0.35, 0.12 + index * 0.18, -0.18 + index * 0.08);
    wisp.userData.baseY = wisp.position.y;
    steamGroup.add(wisp);
  }
  group.add(steamGroup);

  return {group, steamGroup};
}

function createSteamTexture(THREE: typeof import("three")) {
  const canvas = document.createElement("canvas");
  canvas.width = 128;
  canvas.height = 512;
  const context = canvas.getContext("2d");
  if (context) {
    context.clearRect(0, 0, canvas.width, canvas.height);
    for (let index = 0; index < 5; index += 1) {
      const x = 38 + Math.sin(index * 1.7) * 24;
      const y = 430 - index * 78;
      const gradient = context.createRadialGradient(x, y, 2, x, y, 46 + index * 7);
      gradient.addColorStop(0, "rgba(255,255,255,0.34)");
      gradient.addColorStop(0.45, "rgba(210,222,224,0.16)");
      gradient.addColorStop(1, "rgba(210,222,224,0)");
      context.fillStyle = gradient;
      context.beginPath();
      context.ellipse(x, y, 33 + index * 5, 56 + index * 9, -0.25 + index * 0.14, 0, Math.PI * 2);
      context.fill();
    }
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.needsUpdate = true;
  return texture;
}

function createMugMark(THREE: typeof import("three")) {
  const canvas = document.createElement("canvas");
  canvas.width = 256;
  canvas.height = 160;
  const context = canvas.getContext("2d");
  if (context) {
    context.clearRect(0, 0, canvas.width, canvas.height);
    const halo = context.createRadialGradient(canvas.width / 2, canvas.height / 2, 8, canvas.width / 2, canvas.height / 2, 70);
    halo.addColorStop(0, "rgba(255, 224, 119, 0.55)");
    halo.addColorStop(0.58, "rgba(255, 186, 73, 0.2)");
    halo.addColorStop(1, "rgba(255, 186, 73, 0)");
    context.fillStyle = halo;
    context.beginPath();
    context.arc(canvas.width / 2, canvas.height / 2, 74, 0, Math.PI * 2);
    context.fill();

    const eggGradient = context.createRadialGradient(109, 55, 6, 130, 82, 56);
    eggGradient.addColorStop(0, "#fff8c7");
    eggGradient.addColorStop(0.32, "#ffd85c");
    eggGradient.addColorStop(0.72, "#d9941c");
    eggGradient.addColorStop(1, "#8f5812");
    context.fillStyle = eggGradient;
    context.strokeStyle = "rgba(255,246,186,0.95)";
    context.lineWidth = 6;
    context.shadowColor = "rgba(255, 214, 82, 0.95)";
    context.shadowBlur = 18;
    context.beginPath();
    context.ellipse(canvas.width / 2, canvas.height / 2 + 5, 34, 49, 0, 0, Math.PI * 2);
    context.fill();
    context.stroke();

    const shine = context.createLinearGradient(102, 36, 144, 96);
    shine.addColorStop(0, "rgba(255,255,255,0.92)");
    shine.addColorStop(0.5, "rgba(255,255,255,0.22)");
    shine.addColorStop(1, "rgba(255,255,255,0)");
    context.fillStyle = shine;
    context.shadowBlur = 0;
    context.beginPath();
    context.ellipse(116, 58, 10, 21, 0.62, 0, Math.PI * 2);
    context.fill();
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.needsUpdate = true;
  return new THREE.Mesh(new THREE.PlaneGeometry(0.34, 0.22), new THREE.MeshBasicMaterial({map: texture, transparent: true}));
}

function createPaper(THREE: typeof import("three"), paperTexture: Texture) {
  const paper = new THREE.Mesh(
    new THREE.PlaneGeometry(PAPER_WIDTH, PAPER_HEIGHT),
    new THREE.MeshStandardMaterial({map: paperTexture, color: 0xffffff, roughness: 0.9, metalness: 0})
  );
  paper.rotation.x = -Math.PI / 2;
  paper.position.set(0, PAPER_Y, -0.15);
  paper.receiveShadow = true;
  return paper;
}

function createDeskPenModel(THREE: typeof import("three"), source: Object3D) {
  const group = new THREE.Group();
  group.name = "desk-pen";
  group.position.set(2.1, DESK_SURFACE_Y + 0.095, 0.68);
  group.rotation.set(0, 0, 0);

  const model = createNormalizedBlueOfficePen(THREE, source, 0.82);
  group.add(model);
  return group;
}

function createNormalizedBlueOfficePen(THREE: typeof import("three"), source: Object3D, targetLength: number) {
  const wrapper = new THREE.Group();
  const model = cloneBlueOfficePen(THREE, source);
  model.traverse((child) => {
    const mesh = child as Mesh & {castShadow?: boolean; receiveShadow?: boolean};
    if (mesh.isMesh) {
      mesh.castShadow = true;
      mesh.receiveShadow = true;
    }
  });

  const bounds = new THREE.Box3().setFromObject(model);
  const size = bounds.getSize(new THREE.Vector3());
  const center = bounds.getCenter(new THREE.Vector3());
  const longestSide = Math.max(size.x, size.y, size.z, 0.001);
  const scale = targetLength / longestSide;
  model.scale.setScalar(scale);
  model.position.set(-center.x * scale, -center.y * scale, -center.z * scale);
  wrapper.add(model);
  return wrapper;
}

function cloneBlueOfficePen(THREE: typeof import("three"), source: Object3D) {
  const allowedMeshNames = new Set(["Cylinder006_1", "Cylinder006_1_1", "Box006", "Object003"]);
  const group = new THREE.Group();
  source.updateMatrixWorld(true);
  source.traverse((child) => {
    const mesh = child as Mesh;
    if (!mesh.isMesh || !allowedMeshNames.has(mesh.name)) {
      return;
    }
    const clonedMesh = mesh.clone();
    clonedMesh.geometry = mesh.geometry.clone();
    if (Array.isArray(mesh.material)) {
      clonedMesh.material = mesh.material.map((material) => material.clone());
    } else {
      clonedMesh.material = mesh.material.clone();
    }
    clonedMesh.applyMatrix4(mesh.matrixWorld);
    group.add(clonedMesh);
  });
  return group;
}

function createRaisedPenCursor(THREE: typeof import("three")) {
  const group = new THREE.Group();
  group.name = "worksheet-cursor-pen";
  group.position.set(1.08, DESK_SURFACE_Y + 0.12, 0.82 + DESK_RIG_Z);

  const black = new THREE.MeshStandardMaterial({color: 0x050607, roughness: 0.42, metalness: 0.08});
  const blue = new THREE.MeshStandardMaterial({color: 0x22c7d3, roughness: 0.5, metalness: 0.12});
  const metal = new THREE.MeshStandardMaterial({color: 0x111827, roughness: 0.28, metalness: 0.35});
  const axis = new THREE.Vector3(0.46, 0.42, -0.38).normalize();

  // The local origin is the exact writing point. Every part of the pen extends
  // away from this point so the screen reticle and visual tip stay calibrated.
  const tipBase = axis.clone().multiplyScalar(0.13);
  const tip = createConeBetween(THREE, tipBase, new THREE.Vector3(0, 0, 0), 0.038, black);
  const barrel = createCylinderBetween(THREE, axis.clone().multiplyScalar(0.13), axis.clone().multiplyScalar(0.64), 0.041, blue);
  const grip = createCylinderBetween(THREE, axis.clone().multiplyScalar(0.64), axis.clone().multiplyScalar(0.9), 0.052, black);
  const clip = createCylinderBetween(
    THREE,
    axis.clone().multiplyScalar(0.34).add(new THREE.Vector3(0.035, 0.03, 0.028)),
    axis.clone().multiplyScalar(0.72).add(new THREE.Vector3(0.035, 0.03, 0.028)),
    0.01,
    metal
  );
  const endCap = new THREE.Mesh(new THREE.SphereGeometry(0.052, 18, 12), black);
  endCap.position.copy(axis.clone().multiplyScalar(0.93));
  group.add(tip, barrel, grip, clip, endCap);
  group.traverse((child) => {
    const mesh = child as Mesh & {castShadow?: boolean; receiveShadow?: boolean};
    if (mesh.isMesh) {
      mesh.castShadow = true;
      mesh.receiveShadow = true;
    }
  });

  return group;
}

function createCylinderBetween(
  THREE: typeof import("three"),
  start: Vector3,
  end: Vector3,
  radius: number,
  material: import("three").Material
) {
  const length = start.distanceTo(end);
  const mesh = new THREE.Mesh(new THREE.CylinderGeometry(radius, radius, length, 18), material);
  const midpoint = start.clone().add(end).multiplyScalar(0.5);
  const direction = end.clone().sub(start).normalize();
  mesh.position.copy(midpoint);
  mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), direction);
  return mesh;
}

function createConeBetween(
  THREE: typeof import("three"),
  base: Vector3,
  tip: Vector3,
  radius: number,
  material: import("three").Material
) {
  const length = base.distanceTo(tip);
  const mesh = new THREE.Mesh(new THREE.ConeGeometry(radius, length, 20), material);
  const midpoint = base.clone().add(tip).multiplyScalar(0.5);
  const direction = tip.clone().sub(base).normalize();
  mesh.position.copy(midpoint);
  mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), direction);
  return mesh;
}

function roundedCanvasRect(context: CanvasRenderingContext2D, x: number, y: number, width: number, height: number, radius: number) {
  const safeRadius = Math.min(radius, width / 2, height / 2);
  context.beginPath();
  context.moveTo(x + safeRadius, y);
  context.lineTo(x + width - safeRadius, y);
  context.quadraticCurveTo(x + width, y, x + width, y + safeRadius);
  context.lineTo(x + width, y + height - safeRadius);
  context.quadraticCurveTo(x + width, y + height, x + width - safeRadius, y + height);
  context.lineTo(x + safeRadius, y + height);
  context.quadraticCurveTo(x, y + height, x, y + height - safeRadius);
  context.lineTo(x, y + safeRadius);
  context.quadraticCurveTo(x, y, x + safeRadius, y);
  context.closePath();
}

function createWorksheetTexture(
  THREE: typeof import("three"),
  checkedLessonId: GameLessonId | null,
  hoveredChoiceId: GameLessonId | null,
  run: GameWorksheetRunSnapshot | null,
  playback: WorksheetPlaybackState
) {
  const canvas = document.createElement("canvas");
  canvas.width = WORKSHEET_CANVAS_WIDTH;
  canvas.height = WORKSHEET_CANVAS_HEIGHT;
  drawWorksheet(canvas, checkedLessonId, hoveredChoiceId, run, playback);
  const texture = new THREE.CanvasTexture(canvas);
  texture.anisotropy = 8;
  texture.needsUpdate = true;
  return texture;
}

function refreshPaperTexture(
  texture: Texture | null,
  checkedLessonId: GameLessonId | null,
  hoveredChoiceId: GameLessonId | null,
  run: GameWorksheetRunSnapshot | null,
  playback: WorksheetPlaybackState
) {
  if (!texture?.image || !(texture.image instanceof HTMLCanvasElement)) {
    return;
  }
  drawWorksheet(texture.image, checkedLessonId, hoveredChoiceId, run, playback);
  texture.needsUpdate = true;
}

function drawWorksheet(
  canvas: HTMLCanvasElement,
  checkedLessonId: GameLessonId | null,
  hoveredChoiceId: GameLessonId | null,
  run: GameWorksheetRunSnapshot | null,
  playback: WorksheetPlaybackState
) {
  const context = canvas.getContext("2d");
  if (!context) {
    return;
  }
  context.clearRect(0, 0, canvas.width, canvas.height);
  context.fillStyle = "#fffaf0";
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.strokeStyle = "#ded2bd";
  context.lineWidth = 5;
  context.strokeRect(34, 34, canvas.width - 68, canvas.height - 68);

  if (checkedLessonId === GAME_LESSON_TEMPLATE_ID && run?.templateId === GAME_LESSON_TEMPLATE_ID) {
    drawGeneratedWorksheet(context, run, playback);
    return;
  }

  context.fillStyle = "#24313f";
  context.font = "700 58px ui-rounded, system-ui, sans-serif";
  context.fillText("Today’s worksheet", 116, 190);
  context.font = "34px ui-rounded, system-ui, sans-serif";
  context.fillStyle = "#64748b";
  context.fillText("Choose a lesson to begin.", 116, 250);

  for (const choice of LESSON_CHOICES) {
    const active = choice.id === checkedLessonId;
    const hovered = choice.id === hoveredChoiceId;
    context.fillStyle = active ? "#e7f8ef" : hovered ? "#f4f0e7" : "#fffdf8";
    context.strokeStyle = choice.locked ? "#d6c7ae" : active ? "#2f9d65" : hovered ? "#7c5f35" : "#cdbfAA";
    context.lineWidth = hovered || active ? 8 : 4;
    roundRect(context, choice.box.x, choice.box.y, choice.box.width, choice.box.height, 24);
    context.fill();
    context.stroke();

    const checkboxX = choice.box.x + 42;
    const checkboxY = choice.box.y + 48;
    context.strokeStyle = choice.locked ? "#a9987f" : "#314155";
    context.lineWidth = 7;
    roundRect(context, checkboxX, checkboxY, 72, 72, 10);
    context.stroke();
    if (active) {
      context.strokeStyle = "#15803d";
      context.lineWidth = 13;
      context.beginPath();
      context.moveTo(checkboxX + 15, checkboxY + 38);
      context.lineTo(checkboxX + 33, checkboxY + 57);
      context.lineTo(checkboxX + 60, checkboxY + 17);
      context.stroke();
    }

    context.fillStyle = choice.locked ? "#8b8173" : "#1f2937";
    context.font = "700 42px ui-rounded, system-ui, sans-serif";
    context.fillText(choice.title, choice.box.x + 146, choice.box.y + 70);
    context.fillStyle = choice.locked ? "#a69b89" : "#64748b";
    context.font = "30px ui-rounded, system-ui, sans-serif";
    context.fillText(choice.subtitle, choice.box.x + 146, choice.box.y + 122);
  }

  context.strokeStyle = "#e7dac4";
  context.lineWidth = 3;
  for (let index = 0; index < 8; index += 1) {
    const y = 940 + index * 58;
    context.beginPath();
    context.moveTo(118, y);
    context.lineTo(1082, y);
    context.stroke();
  }

  context.fillStyle = "#9a8973";
  context.font = "28px ui-rounded, system-ui, sans-serif";
  context.fillText("Notes", 118, 892);
}

function drawGeneratedWorksheet(context: CanvasRenderingContext2D, run: GameWorksheetRunSnapshot, playback: WorksheetPlaybackState) {
  const pages = worksheetPagesForRun(run);
  const currentPageId = currentWorksheetPageId(run, playback);
  const currentPageIndex = Math.max(0, pages.findIndex((page) => page.id === currentPageId));
  const sections = pageSectionsForRun(run, currentPageId);
  const fillTargets = worksheetFillTargetsForRun(run);
  const complete = artifactForStage(run, "interactive_bundle")?.status === "completed";
  const completedSections = new Set(playback.completedSectionIds);
  const pageComplete = isWorksheetPageComplete(run, playback, currentPageId);
  const nextPageId = nextWorksheetPageId(run, currentPageId);
  const allSectionsComplete = areAllWorksheetSectionsComplete(run, playback);

  context.fillStyle = "#24313f";
  context.font = "800 50px ui-rounded, system-ui, sans-serif";
  context.fillText("Volume With Whole-Number Cubes", 96, 150);
  context.font = "28px ui-rounded, system-ui, sans-serif";
  context.fillStyle = "#64748b";
  context.fillText(
    complete ? `Page ${currentPageIndex + 1} of ${pages.length} · click a section to reveal it` : "Build the worksheet pipeline on the laptop",
    96,
    205
  );

  const status = artifactForStage(run, "interactive_bundle")?.status ?? "waiting";
  context.fillStyle = complete ? "#d9f99d" : "#fef3c7";
  context.strokeStyle = complete ? "#15803d" : "#a16207";
  context.lineWidth = 3;
  roundRect(context, 780, 102, 318, 64, 18);
  context.fill();
  context.stroke();
  context.fillStyle = complete ? "#14532d" : "#713f12";
  context.font = "800 22px ui-monospace, SFMono-Regular, Menlo, monospace";
  context.fillText(`bundle: ${status}`, 810, 143);

  const sectionRects = sectionDisplayRects(sections);
  for (const section of sections) {
    const rect = sectionRects.get(section.id);
    if (!rect) {
      continue;
    }
    const active = playback.activeSectionId === section.id;
    const completed = completedSections.has(section.id);
    context.fillStyle = active ? "#eefcf4" : completed ? "#f7fff9" : "#fffdf8";
    context.strokeStyle = active ? "#0f9f6e" : completed ? "#2f9d65" : complete ? "#8fb99d" : "#cdbfaa";
    context.lineWidth = 4;
    roundRect(context, rect.x, rect.y, rect.width, rect.height, 22);
    context.fill();
    context.stroke();
    context.fillStyle = "#1f2937";
    context.font = "800 34px ui-rounded, system-ui, sans-serif";
    context.fillText(section.title, rect.x + 30, rect.y + 55);
    if (completed) {
      context.strokeStyle = "#15803d";
      context.lineWidth = 8;
      context.beginPath();
      context.moveTo(rect.x + rect.width - 72, rect.y + 50);
      context.lineTo(rect.x + rect.width - 48, rect.y + 76);
      context.lineTo(rect.x + rect.width - 20, rect.y + 30);
      context.stroke();
    }
    if (section.summary) {
      context.font = "24px ui-rounded, system-ui, sans-serif";
      context.fillStyle = "#64748b";
      wrapWorksheetText(context, section.summary, rect.x + 30, rect.y + 92, rect.width - 60, 30, 2);
    }
  }

  context.fillStyle = "#1f2937";
  context.font = "800 30px ui-rounded, system-ui, sans-serif";
  context.fillText(currentPageId === "page_2" ? "Guided-practice answers" : "Section notes", 96, 650);
  context.strokeStyle = "#e7dac4";
  context.lineWidth = 3;
  let rowY = 710;
  const pageTargets = fillTargets.filter((target) => (target.pageId ?? "page_1") === currentPageId);
  for (const target of pageTargets) {
    const revealedText = worksheetTargetRevealText(run, playback, target);
    context.beginPath();
    context.moveTo(110, rowY + 30);
    context.lineTo(1090, rowY + 30);
    context.stroke();
    context.fillStyle = revealedText ? "#1e3a8a" : "#9a8973";
    context.font = revealedText ? "30px Chalkboard SE, Comic Sans MS, ui-rounded, system-ui, sans-serif" : "26px ui-rounded, system-ui, sans-serif";
    context.fillText(revealedText || (complete ? "click a section to reveal" : "waiting for interactive bundle"), 120, rowY);
    rowY += 72;
  }

  if (complete && pageComplete && nextPageId) {
    context.fillStyle = "#e7f8ef";
    context.strokeStyle = "#15803d";
    context.lineWidth = 4;
    roundRect(context, WORKSHEET_NEXT_PAGE_RECT.x, WORKSHEET_NEXT_PAGE_RECT.y, WORKSHEET_NEXT_PAGE_RECT.width, WORKSHEET_NEXT_PAGE_RECT.height, 18);
    context.fill();
    context.stroke();
    context.fillStyle = "#14532d";
    context.font = "900 25px ui-monospace, SFMono-Regular, Menlo, monospace";
    context.fillText("NEXT PAGE  →", WORKSHEET_NEXT_PAGE_RECT.x + 42, WORKSHEET_NEXT_PAGE_RECT.y + 47);
  } else if (complete && allSectionsComplete) {
    context.fillStyle = playback.lessonCompletedAt ? "#dcfce7" : "#fff7ed";
    context.strokeStyle = playback.lessonCompletedAt ? "#16a34a" : "#ea580c";
    context.lineWidth = 4;
    roundRect(
      context,
      WORKSHEET_COMPLETE_RECT.x,
      WORKSHEET_COMPLETE_RECT.y,
      WORKSHEET_COMPLETE_RECT.width,
      WORKSHEET_COMPLETE_RECT.height,
      18
    );
    context.fill();
    context.stroke();
    context.fillStyle = playback.lessonCompletedAt ? "#14532d" : "#7c2d12";
    context.font = "900 23px ui-monospace, SFMono-Regular, Menlo, monospace";
    context.fillText(playback.lessonCompletedAt ? "LESSON COMPLETE" : "COMPLETE LESSON", WORKSHEET_COMPLETE_RECT.x + 34, WORKSHEET_COMPLETE_RECT.y + 46);
  }

  context.fillStyle = "#9a8973";
  context.font = "24px ui-rounded, system-ui, sans-serif";
  context.fillText(
    playback.lessonCompletedAt ? "Progress saved. Reset will return this worksheet to page 1." : "Progress is saved locally for this lesson run.",
    96,
    1455
  );
}

function roundRect(context: CanvasRenderingContext2D, x: number, y: number, width: number, height: number, radius: number) {
  context.beginPath();
  context.moveTo(x + radius, y);
  context.lineTo(x + width - radius, y);
  context.quadraticCurveTo(x + width, y, x + width, y + radius);
  context.lineTo(x + width, y + height - radius);
  context.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
  context.lineTo(x + radius, y + height);
  context.quadraticCurveTo(x, y + height, x, y + height - radius);
  context.lineTo(x, y + radius);
  context.quadraticCurveTo(x, y, x + radius, y);
  context.closePath();
}

function interactiveBundleForRun(run: GameWorksheetRunSnapshot | null): InteractiveWorksheetBundle | null {
  const artifact = artifactForStage(run, "interactive_bundle");
  if (!artifact || artifact.status !== "completed") {
    return null;
  }
  return {
    fillTargets: worksheetFillTargetsFromPayload(artifact.payload),
    pages: Array.isArray(artifact.payload.pages) ? (artifact.payload.pages as InteractiveWorksheetBundle["pages"]) : [],
    sections: worksheetSectionsFromPayload(artifact.payload)
  };
}

function templatePayloadForRun(run: GameWorksheetRunSnapshot): Record<string, unknown> {
  return artifactForStage(run, "template")?.payload ?? run.templatePayload;
}

function worksheetPagesFromPayload(payload: Record<string, unknown> | null | undefined): Array<{id: string; pageNumber?: number}> {
  const pages = Array.isArray(payload?.pages) ? payload.pages : [];
  return pages.flatMap((page) => {
    if (!isRecord(page) || typeof page.id !== "string") {
      return [];
    }
    return [{id: page.id, pageNumber: typeof page.pageNumber === "number" ? page.pageNumber : undefined}];
  });
}

function worksheetPagesForRun(run: GameWorksheetRunSnapshot): Array<{id: string; pageNumber?: number}> {
  const bundle = interactiveBundleForRun(run);
  const template = templatePayloadForRun(run);
  const pages = bundle?.pages?.length ? bundle.pages : worksheetPagesFromPayload(template);
  return pages.length ? pages : [{id: "page_1", pageNumber: 1}];
}

function worksheetSectionsForRun(run: GameWorksheetRunSnapshot): WorksheetSection[] {
  const bundle = interactiveBundleForRun(run);
  const template = templatePayloadForRun(run);
  const templateSections = worksheetSectionsFromPayload(template);
  if (!bundle?.sections?.length) {
    return templateSections;
  }
  const templateById = new Map(templateSections.map((section) => [section.id, section]));
  return bundle.sections.map((section) => ({...templateById.get(section.id), ...section}));
}

function worksheetFillTargetsForRun(run: GameWorksheetRunSnapshot): WorksheetFillTarget[] {
  const bundle = interactiveBundleForRun(run);
  const template = templatePayloadForRun(run);
  return bundle?.fillTargets?.length ? bundle.fillTargets : worksheetFillTargetsFromPayload(template);
}

function worksheetNarrationForSection(run: GameWorksheetRunSnapshot, sectionId: string): WorksheetNarrationSection | null {
  return worksheetSectionsForRun(run).find((section) => section.id === sectionId)?.narration ?? null;
}

function worksheetActionsForSection(run: GameWorksheetRunSnapshot, sectionId: string): WorksheetHandwritingAction[] {
  const section = worksheetSectionsForRun(run).find((candidate) => candidate.id === sectionId);
  if (section?.handwritingActions?.length) {
    return section.handwritingActions;
  }
  return worksheetHandwritingActionsFromPayload(artifactForStage(run, "handwriting")?.payload?.actions).filter((action) => action.sectionId === sectionId);
}

function sectionPlaybackDurationMs(run: GameWorksheetRunSnapshot, sectionId: string) {
  const narration = worksheetNarrationForSection(run, sectionId);
  if (typeof narration?.durationSeconds === "number" && narration.durationSeconds > 0) {
    return Math.max(2_500, narration.durationSeconds * 1000);
  }
  const maxActionEnd = worksheetActionsForSection(run, sectionId).reduce((max, action) => Math.max(max, action.endSeconds ?? 0), 0);
  return Math.max(3_500, maxActionEnd > 0 ? maxActionEnd * 1000 : 5_500);
}

function worksheetTargetRevealText(run: GameWorksheetRunSnapshot, playback: WorksheetPlaybackState, target: WorksheetFillTarget) {
  const sectionId = target.sectionId;
  if (!sectionId) {
    return "";
  }
  if (playback.completedSectionIds.includes(sectionId)) {
    return target.expectedText ?? target.id;
  }
  if (playback.activeSectionId !== sectionId || !playback.activeSectionStartedAt) {
    return "";
  }
  const action = worksheetActionsForSection(run, sectionId).find((candidate) => candidate.fillTargetId === target.id);
  const sourceText = action?.text ?? target.expectedText ?? "";
  if (!sourceText) {
    return "";
  }
  const elapsedSeconds = Math.max(0, (Date.now() - playback.activeSectionStartedAt) / 1000);
  const startSeconds = action?.startSeconds ?? 0;
  const endSeconds = action?.endSeconds ?? Math.max(startSeconds + 1.4, startSeconds + sourceText.length * 0.055);
  if (elapsedSeconds <= startSeconds) {
    return "";
  }
  const progress = Math.max(0, Math.min(1, (elapsedSeconds - startSeconds) / Math.max(0.1, endSeconds - startSeconds)));
  return sourceText.slice(0, Math.max(1, Math.ceil(sourceText.length * progress)));
}

function currentWorksheetPageId(run: GameWorksheetRunSnapshot, playback: WorksheetPlaybackState) {
  const pages = worksheetPagesForRun(run);
  if (playback.currentPageId && pages.some((page) => page.id === playback.currentPageId)) {
    return playback.currentPageId;
  }
  return pages[0]?.id ?? "page_1";
}

function nextWorksheetPageId(run: GameWorksheetRunSnapshot, currentPageId: string) {
  const pages = worksheetPagesForRun(run);
  const currentIndex = pages.findIndex((page) => page.id === currentPageId);
  if (currentIndex < 0 || currentIndex >= pages.length - 1) {
    return null;
  }
  return pages[currentIndex + 1]?.id ?? null;
}

function pageSectionsForRun(run: GameWorksheetRunSnapshot, pageId: string) {
  return worksheetSectionsForRun(run).filter((section) => (section.pageId ?? "page_1") === pageId);
}

function isWorksheetPageComplete(run: GameWorksheetRunSnapshot, playback: WorksheetPlaybackState, pageId: string) {
  const completedSections = new Set(playback.completedSectionIds);
  const sections = pageSectionsForRun(run, pageId);
  return sections.length > 0 && sections.every((section) => completedSections.has(section.id));
}

function areAllWorksheetSectionsComplete(run: GameWorksheetRunSnapshot, playback: WorksheetPlaybackState) {
  const sections = worksheetSectionsForRun(run);
  const completedSections = new Set(playback.completedSectionIds);
  return sections.length > 0 && sections.every((section) => completedSections.has(section.id));
}

function worksheetSectionsFromPayload(payload: Record<string, unknown> | null | undefined): WorksheetSection[] {
  const sections = Array.isArray(payload?.sections) ? payload.sections : [];
  return sections.flatMap((section) => {
    if (!isRecord(section) || typeof section.title !== "string") {
      return [];
    }
    const id = typeof section.id === "string" ? section.id : typeof section.sectionId === "string" ? section.sectionId : null;
    if (!id) {
      return [];
    }
    return [
      {
        id,
        completionMode: typeof section.completionMode === "string" ? section.completionMode : undefined,
        handwritingActions: worksheetHandwritingActionsFromPayload(section.handwritingActions),
        narration: worksheetNarrationFromPayload(section.narration),
        pageId: typeof section.pageId === "string" ? section.pageId : undefined,
        regionId: typeof section.regionId === "string" ? section.regionId : undefined,
        summary: typeof section.summary === "string" ? section.summary : undefined,
        title: section.title
      }
    ];
  });
}

function worksheetNarrationFromPayload(value: unknown): WorksheetNarrationSection | undefined {
  if (!isRecord(value)) {
    return undefined;
  }
  return {
    audioUrl: typeof value.audioUrl === "string" ? value.audioUrl : null,
    durationSeconds: typeof value.durationSeconds === "number" ? value.durationSeconds : undefined,
    sectionId: typeof value.sectionId === "string" ? value.sectionId : undefined,
    speechText: typeof value.speechText === "string" ? value.speechText : undefined
  };
}

function worksheetHandwritingActionsFromPayload(value: unknown): WorksheetHandwritingAction[] {
  const actions = Array.isArray(value) ? value : [];
  return actions.flatMap((action) => {
    if (!isRecord(action) || typeof action.id !== "string") {
      return [];
    }
    return [
      {
        endSeconds: typeof action.endSeconds === "number" ? action.endSeconds : undefined,
        fillTargetId: typeof action.fillTargetId === "string" ? action.fillTargetId : undefined,
        id: action.id,
        sectionId: typeof action.sectionId === "string" ? action.sectionId : undefined,
        startSeconds: typeof action.startSeconds === "number" ? action.startSeconds : undefined,
        text: typeof action.text === "string" ? action.text : undefined
      }
    ];
  });
}

function worksheetFillTargetsFromPayload(payload: Record<string, unknown> | null | undefined): WorksheetFillTarget[] {
  const fillTargets = Array.isArray(payload?.fillTargets) ? payload.fillTargets : [];
  return fillTargets.flatMap((target) => {
    if (!isRecord(target) || typeof target.id !== "string" || !isWorksheetRect(target.rect)) {
      return [];
    }
    return [
      {
        expectedText: typeof target.expectedText === "string" ? target.expectedText : undefined,
        id: target.id,
        pageId: typeof target.pageId === "string" ? target.pageId : undefined,
        questionId: typeof target.questionId === "string" ? target.questionId : undefined,
        rect: target.rect,
        sectionId: typeof target.sectionId === "string" ? target.sectionId : undefined
      }
    ];
  });
}

function sectionDisplayRects(sections: WorksheetSection[]) {
  const rects = new Map<string, {height: number; width: number; x: number; y: number}>();
  const fallback = [
    {height: 150, width: 998, x: 96, y: 275},
    {height: 150, width: 998, x: 96, y: 450},
    {height: 150, width: 998, x: 96, y: 1090}
  ];
  sections.forEach((section, index) => {
    rects.set(section.id, fallback[index] ?? {height: 132, width: 998, x: 96, y: 275 + index * 160});
  });
  return rects;
}

function wrapWorksheetText(
  context: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  maxWidth: number,
  lineHeight: number,
  maxLines: number
) {
  const words = text.split(/\s+/);
  let line = "";
  let currentY = y;
  let lines = 0;
  for (const word of words) {
    const next = line ? `${line} ${word}` : word;
    if (context.measureText(next).width > maxWidth && line) {
      context.fillText(line, x, currentY);
      lines += 1;
      if (lines >= maxLines) {
        return;
      }
      line = word;
      currentY += lineHeight;
    } else {
      line = next;
    }
  }
  if (line && lines < maxLines) {
    context.fillText(line, x, currentY);
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isWorksheetRect(value: unknown): value is WorksheetRect {
  return (
    isRecord(value) &&
    typeof value.x === "number" &&
    typeof value.y === "number" &&
    typeof value.width === "number" &&
    typeof value.height === "number"
  );
}

function choiceAtCanvasPoint(x: number, y: number) {
  return LESSON_CHOICES.find((choice) => x >= choice.box.x && x <= choice.box.x + choice.box.width && y >= choice.box.y && y <= choice.box.y + choice.box.height) ?? null;
}

function worksheetActionAtCanvasPoint(
  x: number,
  y: number,
  run: GameWorksheetRunSnapshot,
  playback: WorksheetPlaybackState
):
  | {pageId: string; type: "next_page"}
  | {section: WorksheetSection; type: "section"}
  | {type: "complete_lesson"}
  | null {
  if (artifactForStage(run, "interactive_bundle")?.status !== "completed") {
    return null;
  }
  const currentPageId = currentWorksheetPageId(run, playback);
  const nextPageId = nextWorksheetPageId(run, currentPageId);
  if (isWorksheetPageComplete(run, playback, currentPageId) && nextPageId && pointInRect(x, y, WORKSHEET_NEXT_PAGE_RECT)) {
    return {pageId: nextPageId, type: "next_page"};
  }
  if (areAllWorksheetSectionsComplete(run, playback) && !nextPageId && pointInRect(x, y, WORKSHEET_COMPLETE_RECT)) {
    return {type: "complete_lesson"};
  }
  const sections = pageSectionsForRun(run, currentPageId);
  const rects = sectionDisplayRects(sections);
  const section =
    sections.find((section) => {
      const rect = rects.get(section.id);
      return rect ? pointInRect(x, y, rect) : false;
    }) ?? null;
  return section ? {section, type: "section"} : null;
}

function pointInRect(x: number, y: number, rect: {height: number; width: number; x: number; y: number}) {
  return x >= rect.x && x <= rect.x + rect.width && y >= rect.y && y <= rect.y + rect.height;
}
