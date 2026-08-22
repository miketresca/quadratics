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
  updateGameLessonArtifactPayload,
  type GameLessonArtifact,
  type GameLessonStage,
  type GameWorksheetRunSnapshot
} from "@/lib/api";
import {getGameProgress, resetGameProgress, updateGameProgress} from "@/lib/game/progress-client";
import {createClient} from "@/lib/supabase/client";

import {
  LaptopFocusPanel,
  type LaptopCostState,
  type LaptopPipelineState,
  type LaptopTab,
  type MusicOptionId,
  type MusicState
} from "./game-laptop-panels";
import {usernameFromAuthEmail, usernameToAuthEmail} from "./game-auth-utils";
import {refreshClockTexture} from "./game-clock";
import {createDeskLaptop, createDeskSupplies} from "./game-desk-props";
import {createDeskSurface} from "./game-desk-surface";
import {ClockFocusPanel, PhoneRewardVideoPanel} from "./game-focus-panels";
import {createLaptopScreen, formatSceneTransform} from "./game-laptop-screen";
import {refreshPhoneScreenTexture, setCssRendererInteraction, setCssRendererVisibility} from "./game-phone";
import {createOfficeBackdrop} from "./game-room-environment";
import {loadVisitorLocation, loadWorldMapGeoJson, updateWorldMapTexture} from "./game-visitor-map";
import {
  GAME_LESSON_STAGES,
  isGameLessonPublished
} from "./game-pipeline-utils";
import {
  DEFAULT_WORKSHEET_PLAYBACK,
  clampMusicVolume,
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
import {
  ALARM_SOUND_URL,
  DESK_RIG_Z,
  DESK_SURFACE_Y,
  GAME_LESSON_TEMPLATE_ID,
  LESSON_CHOICES,
  PAPER_HEIGHT,
  PAPER_WIDTH,
  PAPER_Y,
  PHONE_FOCUS_QUOTES,
  PHONE_VIBRATION_SOUND_URL,
  ROOM,
  SEATED_CAMERA_Z,
  VISITOR_HISTORY_PINS,
  WORKSHEET_CANVAS_HEIGHT,
  WORKSHEET_CANVAS_WIDTH
} from "./game-scene-config";
import type {
  FocusMode,
  InteractiveTarget,
  LaptopScreenApi,
  PhoneScreenMode,
  SceneTunableName,
  VisitorLocation,
  VisitorMapPin,
  WorldMapGeoJson
} from "./game-types";
import {
  areAllWorksheetSectionsComplete,
  areWorksheetAnswersCorrect,
  checkWorksheetAnswers,
  choiceAtCanvasPoint,
  createWorksheetTexture,
  isWorksheetReadyToSubmit,
  refreshPaperTexture,
  sectionPlaybackDurationMs,
  worksheetActionAtCanvasPoint,
  worksheetActionsForSection,
  worksheetNarrationForSection
} from "./game-worksheet-renderer";
import {createDeskPenModel, createPaper, createRaisedPenCursor} from "./game-worksheet-props";

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

  function updateWorksheetAnswer(targetId: string, answer: string) {
    const nextResults = {...worksheetPlaybackRef.current.answerResults};
    delete nextResults[targetId];
    setWorksheetPlaybackSnapshot({
      ...worksheetPlaybackRef.current,
      answerResults: nextResults,
      answers: {
        ...worksheetPlaybackRef.current.answers,
        [targetId]: answer
      },
      lessonCompletedAt: null,
      submittedAt: null
    });
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

  async function saveGameLessonPipelineArtifact(artifact: GameLessonArtifact, payload: Record<string, unknown>) {
    const requestId = gamePipelineRequestRef.current + 1;
    gamePipelineRequestRef.current = requestId;
    const requestingUserId = userRef.current?.id;
    if (!requestingUserId) {
      throw new Error("Login on the laptop to edit this lesson.");
    }
    setGamePipelineLoading(true);
    setGamePipelineLoadingStage(artifact.stage);
    setGamePipelineError(null);
    laptopScreenRef.current?.setPipelineState({error: null, loading: true, loadingStage: artifact.stage, run: gameRunRef.current});
    try {
      const accessToken = await getLaptopAccessToken();
      const snapshot = await updateGameLessonArtifactPayload({
        accessToken,
        artifactId: artifact.id,
        notes: "Edited from laptop pipeline console.",
        payload
      });
      if (gamePipelineRequestRef.current !== requestId || userRef.current?.id !== requestingUserId) {
        return null;
      }
      setGameRunSnapshot(snapshot);
      void refreshGameUsageCosts();
      return snapshot;
    } catch (error) {
      const message = error instanceof Error ? error.message : "Could not save worksheet artifact.";
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
    const coordinateTargets: Object3D[] = [];
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
      coordinateTargets.push(backdrop.group);
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
      coordinateTargets.push(deskRig);

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
        onSaveArtifact: (artifact, payload) => {
          void saveGameLessonPipelineArtifact(artifact, payload).catch(() => {
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
        const coordinateHit = raycaster
          .intersectObjects(paperMesh ? [paperMesh, ...coordinateTargets] : coordinateTargets, true)
          .find((hit) => hit.object.visible);
        updatePointedCoordinates(coordinateHit?.point ?? null);
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
          if (action?.type === "fill_target") {
            setLockedMessage(null);
            const nextResults = {...worksheetPlaybackRef.current.answerResults};
            delete nextResults[action.target.id];
            setWorksheetPlaybackSnapshot({
              ...worksheetPlaybackRef.current,
              activeFillTargetId: action.target.id,
              answerResults: nextResults,
              submittedAt: null
            });
          } else if (action?.type === "submit_answers") {
            if (!isWorksheetReadyToSubmit(gameRunRef.current, worksheetPlaybackRef.current)) {
              setLockedMessage("Fill in every answer box before checking your work.");
              return;
            }
            const checkedPlayback = {
              ...worksheetPlaybackRef.current,
              activeFillTargetId: null,
              answerResults: checkWorksheetAnswers(gameRunRef.current, worksheetPlaybackRef.current),
              submittedAt: Date.now()
            };
            setWorksheetPlaybackSnapshot(checkedPlayback);
            setLockedMessage(areWorksheetAnswersCorrect(gameRunRef.current, checkedPlayback) ? "All answers are correct. Continue the lesson." : "Some answers need another look.");
          } else if (action?.type === "section") {
            setLockedMessage(null);
            startWorksheetSectionPlayback(gameRunRef.current, action.section.id);
            changeLaptopTab("pipeline");
          } else if (action?.type === "next_page") {
            setLockedMessage(null);
            clearSectionPlayback();
            setWorksheetPlaybackSnapshot({
              ...worksheetPlaybackRef.current,
              activeFillTargetId: null,
              activeSectionId: null,
              activeSectionStartedAt: null,
              currentPageId: action.pageId
            });
          } else if (action?.type === "complete_lesson") {
            setLockedMessage(null);
            clearSectionPlayback();
            const nextPlayback = {...worksheetPlaybackRef.current, activeFillTargetId: null, lessonCompletedAt: Date.now()};
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
        const activeFillTargetId = worksheetPlaybackRef.current.activeFillTargetId;
        if (focusModeRef.current === "paper" && activeFillTargetId) {
          if (event.key === "Backspace") {
            event.preventDefault();
            updateWorksheetAnswer(activeFillTargetId, (worksheetPlaybackRef.current.answers[activeFillTargetId] ?? "").slice(0, -1));
            return;
          }
          if (event.key === "Enter") {
            event.preventDefault();
            setWorksheetPlaybackSnapshot({...worksheetPlaybackRef.current, activeFillTargetId: null});
            return;
          }
          if (event.key.length === 1 && !event.metaKey && !event.ctrlKey && !event.altKey) {
            event.preventDefault();
            const currentAnswer = worksheetPlaybackRef.current.answers[activeFillTargetId] ?? "";
            updateWorksheetAnswer(activeFillTargetId, `${currentAnswer}${event.key}`.slice(0, 96));
            return;
          }
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
          onSaveArtifact={(artifact, payload) => {
            void saveGameLessonPipelineArtifact(artifact, payload).catch(() => {
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
