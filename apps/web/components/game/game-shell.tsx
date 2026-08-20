"use client";

import type {CurrentUser, GameFighterId, GameLessonId, GameProgress} from "@quadratics/types";
import type {Dispatch, KeyboardEvent as ReactKeyboardEvent, RefObject, SetStateAction} from "react";
import {useCallback, useEffect, useMemo, useRef, useState} from "react";
import type {Group, Material, Object3D, PerspectiveCamera, Scene, WebGLRenderer} from "three";
import type {OrbitControls as OrbitControlsType} from "three/examples/jsm/controls/OrbitControls.js";

import {GAME_AUDIO_CUES, GAME_FIGHTERS, getFighter, type GameAudioCueId, type GameFighter} from "@/lib/game/assets";
import {GAME_LESSONS, getGameLesson, type GameLesson} from "@/lib/game/lessons";
import {getGameProgress, resetGameProgress, updateGameProgress} from "@/lib/game/progress-client";
import {createClient} from "@/lib/supabase/client";

type GameMode = "select" | "arena" | "lesson";
type Prompt = "login" | "locked" | "save-failed" | "reset-confirm" | null;
type PlayerState = {x: number; y: number; vy: number; grounded: boolean; facing: 1 | -1; moving: boolean};

const ARENA_WIDTH = 960;
const ARENA_HEIGHT = 540;
const GROUND_Y = 388;
const PLAYER_WIDTH = 76;
const PLAYER_HEIGHT = 92;
const PLAYER_MIN_X = 70;
const PLAYER_MAX_X = ARENA_WIDTH - 70 - PLAYER_WIDTH;
const SPEED = 5.6;
const GRAVITY = 0.72;
const JUMP_VELOCITY = -14;
const PLATFORM_TOP_Y = -1.7;
const ARENA_FIGHTER_HEIGHT = 1.8;
const CARD_FIGHTER_HEIGHT = 2.25;
const ORB_MODEL_Y = PLATFORM_TOP_Y + 3.65;
const GAME_SESSION_KEY = "quadratics-game-session";
const ORBS = [
  {lessonId: "volume-cubes-lesson-1" as const, x: 360, y: 150},
  {lessonId: "dynamic-lesson-locked" as const, x: 600, y: 150}
];

export function GameShell({
  initialFighterId,
  initialMode,
  initialUser
}: {
  initialFighterId?: GameFighterId | null;
  initialMode?: GameMode;
  initialUser: CurrentUser | null;
}) {
  const [mode, setMode] = useState<GameMode>(initialMode ?? "select");
  const [prompt, setPrompt] = useState<Prompt>(null);
  const [selectedFighterId, setSelectedFighterId] = useState<GameFighterId | null>(initialFighterId ?? "captain-falcon");
  const [focusedFighterIndex, setFocusedFighterIndex] = useState(0);
  const [activeLessonId, setActiveLessonId] = useState<GameLessonId>("volume-cubes-lesson-1");
  const [progress, setProgress] = useState<GameProgress>({selectedFighterId: null, lessons: []});
  const [progressError, setProgressError] = useState<string | null>(null);
  const [progressBusy, setProgressBusy] = useState(false);
  const [startBusy, setStartBusy] = useState(false);
  const [logsOpen, setLogsOpen] = useState(false);
  const [player, setPlayer] = useState<PlayerState>({x: 448, y: GROUND_Y, vy: 0, grounded: true, facing: 1, moving: false});
  const [pdfReady, setPdfReady] = useState(false);
  const keysRef = useRef(new Set<string>());
  const frameRef = useRef<number | null>(null);
  const collisionLessonRef = useRef<GameLessonId | null>(null);
  const playerRef = useRef<PlayerState>({x: 448, y: GROUND_Y, vy: 0, grounded: true, facing: 1, moving: false});
  const progressRequestRef = useRef(0);
  const startBusyRef = useRef(false);
  const promptCloseRef = useRef<HTMLButtonElement | null>(null);
  const audioRef = useRef<Partial<Record<GameAudioCueId, HTMLAudioElement>>>({});
  const signedIn = initialUser !== null;
  const selectedFighter = getFighter(selectedFighterId);
  const activeLesson = getGameLesson(activeLessonId);

  useEffect(() => {
    if (initialMode) {
      return;
    }
    const stored = readGameSession();
    if (!stored) {
      return;
    }
    setMode(stored.mode);
    setSelectedFighterId(stored.selectedFighterId);
    setFocusedFighterIndex(Math.max(0, GAME_FIGHTERS.findIndex((fighter) => fighter.id === stored.selectedFighterId)));
  }, [initialMode]);

  useEffect(() => {
    writeGameSession({mode, selectedFighterId: selectedFighter.id});
  }, [mode, selectedFighter.id]);

  useEffect(() => {
    if (!signedIn) {
      return;
    }
    let cancelled = false;
    async function loadProgress() {
      const token = await accessToken();
      if (!token) {
        return;
      }
      const loaded = await getGameProgress(token).catch(() => null);
      if (!cancelled && loaded) {
        setProgress(loaded);
        setSelectedFighterId(loaded.selectedFighterId ?? "captain-falcon");
        setFocusedFighterIndex(Math.max(0, GAME_FIGHTERS.findIndex((fighter) => fighter.id === loaded.selectedFighterId)));
      }
    }
    void loadProgress();
    return () => {
      cancelled = true;
    };
  }, [signedIn]);

  useEffect(() => {
    const audio: Partial<Record<GameAudioCueId, HTMLAudioElement>> = {};
    for (const [cue, src] of Object.entries(GAME_AUDIO_CUES) as [GameAudioCueId, string][]) {
      const element = new Audio(src);
      element.preload = cue === "choose" ? "auto" : "metadata";
      element.volume = cue === "choose" ? 0.42 : 0.5;
      audio[cue] = element;
    }
    audioRef.current = audio;
    return () => {
      for (const element of Object.values(audioRef.current)) {
        element?.pause();
      }
      audioRef.current = {};
    };
  }, []);

  useEffect(() => {
    playerRef.current = player;
  }, [player]);

  useEffect(() => {
    startBusyRef.current = startBusy;
  }, [startBusy]);

  useEffect(() => {
    if (!prompt) {
      return;
    }
    const previousActiveElement = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    window.setTimeout(() => promptCloseRef.current?.focus(), 0);
    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        setPrompt(null);
      }
    }
    window.addEventListener("keydown", closeOnEscape);
    return () => {
      window.removeEventListener("keydown", closeOnEscape);
      previousActiveElement?.focus();
    };
  }, [prompt]);

  useEffect(() => {
    if (mode !== "arena") {
      return;
    }
    function onKeyDown(event: KeyboardEvent) {
      const key = event.key.toLowerCase();
      if (["arrowleft", "arrowright", "arrowup", " ", "a", "d", "w"].includes(key)) {
        event.preventDefault();
        keysRef.current.add(key);
      }
    }
    function onKeyUp(event: KeyboardEvent) {
      keysRef.current.delete(event.key.toLowerCase());
    }
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
      keysRef.current.clear();
    };
  }, [mode]);

  useEffect(() => {
    if (mode !== "arena") {
      if (frameRef.current !== null) {
        cancelAnimationFrame(frameRef.current);
        frameRef.current = null;
      }
      collisionLessonRef.current = null;
      return;
    }
    const tick = () => {
      const current = playerRef.current;
      const keys = keysRef.current;
      let nextX = current.x;
      let nextVy = current.vy;
      let facing = current.facing;
      let moving = false;
      if (keys.has("arrowleft") || keys.has("a")) {
        nextX -= SPEED;
        facing = -1;
        moving = true;
      }
      if (keys.has("arrowright") || keys.has("d")) {
        nextX += SPEED;
        facing = 1;
        moving = true;
      }
      if ((keys.has(" ") || keys.has("arrowup") || keys.has("w")) && current.grounded) {
        nextVy = JUMP_VELOCITY;
        playCue(audioRef, selectedFighter.jumpCue);
      }
      const nextY = current.y + nextVy;
      nextVy += GRAVITY;
      const grounded = nextY >= GROUND_Y;
      const boundedX = Math.max(PLAYER_MIN_X, Math.min(PLAYER_MAX_X, nextX));
      const resolvedY = grounded ? GROUND_Y : nextY;
      const next = {x: boundedX, y: resolvedY, vy: grounded ? 0 : nextVy, grounded, facing, moving};
      playerRef.current = next;
      setPlayer(next);
      const hitOrb = ORBS.find((orb) => intersectsOrb(next, orb));
      if (hitOrb && collisionLessonRef.current !== hitOrb.lessonId) {
        collisionLessonRef.current = hitOrb.lessonId;
        activateLesson(hitOrb.lessonId);
      }
      frameRef.current = requestAnimationFrame(tick);
    };
    frameRef.current = requestAnimationFrame(tick);
    return () => {
      if (frameRef.current !== null) {
        cancelAnimationFrame(frameRef.current);
      }
      frameRef.current = null;
    };
  }, [mode, selectedFighter.jumpCue]);

  const completedLessonIds = useMemo(
    () => new Set(progress.lessons.filter((lesson) => lesson.status === "completed").map((lesson) => lesson.lessonId)),
    [progress.lessons]
  );
  const startedLessonIds = useMemo(
    () => new Set(progress.lessons.filter((lesson) => lesson.status === "started" || lesson.status === "completed").map((lesson) => lesson.lessonId)),
    [progress.lessons]
  );

  const persist = useCallback(async (request: Parameters<typeof updateGameProgress>[0]["request"]) => {
    const requestId = progressRequestRef.current + 1;
    progressRequestRef.current = requestId;
    const token = await accessToken();
    if (!token) {
      setPrompt("login");
      return null;
    }
    setProgressBusy(true);
    setProgressError(null);
    try {
      const updated = await updateGameProgress({accessToken: token, request});
      if (progressRequestRef.current === requestId) {
        setProgress(updated);
      }
      return updated;
    } catch (error) {
      const message = error instanceof Error ? error.message : "Could not save game progress";
      setProgressError(message);
      setPrompt("save-failed");
      return null;
    } finally {
      if (progressRequestRef.current === requestId) {
        setProgressBusy(false);
      }
    }
  }, []);

  async function selectFighter(fighter: GameFighter) {
    playCue(audioRef, fighter.voiceCue);
    if (!signedIn) {
      setSelectedFighterId(fighter.id);
      setPrompt("login");
      return;
    }
    setSelectedFighterId(fighter.id);
    await persist({action: "select_fighter", selectedFighterId: fighter.id});
  }

  async function startGame() {
    if (startBusyRef.current) {
      return;
    }
    if (!signedIn) {
      setPrompt("login");
      return;
    }
    setStartBusy(true);
    if (selectedFighterId) {
      await persist({action: "select_fighter", selectedFighterId});
    }
    playCue(audioRef, "start");
    setMode("arena");
    setPrompt(null);
    setStartBusy(false);
  }

  const activateLesson = useCallback(
    (lessonId: GameLessonId) => {
      const lesson = getGameLesson(lessonId);
      if (lesson.status === "locked") {
        playCue(audioRef, "denied");
        setActiveLessonId(lessonId);
        setPrompt("locked");
        return;
      }
      playCue(audioRef, "orb");
      setActiveLessonId(lessonId);
      setMode("lesson");
      void persist({action: "start_lesson", lessonId});
    },
    [persist]
  );

  async function completeLesson() {
    await persist({action: "complete_lesson", lessonId: activeLesson.id});
    playCue(audioRef, "complete");
  }

  async function confirmReset() {
    const token = await accessToken();
    if (!token) {
      setPrompt("login");
      return;
    }
    setProgressBusy(true);
    setProgressError(null);
    try {
      const reset = await resetGameProgress(token);
      setProgress(reset);
      setSelectedFighterId("captain-falcon");
      setMode("select");
      setPrompt(null);
      playCue(audioRef, "denied");
    } catch (error) {
      setProgressError(error instanceof Error ? error.message : "Could not reset game progress");
      setPrompt("save-failed");
    } finally {
      setProgressBusy(false);
    }
  }

  return (
    <section className="mx-auto flex min-h-screen w-full max-w-[min(1680px,calc(100vw-1.5rem))] flex-col px-3 pb-8 pt-24 sm:px-4">
      <div className="game-stage-shell relative min-h-[calc(100vh-7rem)] overflow-hidden rounded border border-zinc-800 bg-[#030508]/86 shadow-[0_0_40px_rgba(16,185,129,0.08)]">
        <div className="flex items-center justify-between border-b border-zinc-800/80 px-4 py-3">
          <div>
            <p className="font-mono text-xs uppercase tracking-wide text-emerald-300">Quadratics Game Lab</p>
            <h1 className="font-mono text-xl font-bold tracking-wide text-zinc-100 sm:text-2xl">
              {mode === "select" ? "Choose your character" : "Select your lesson"}
            </h1>
          </div>
          <div className="flex items-center gap-2">
            {signedIn ? (
              <button
                className="rounded border border-zinc-700 px-3 py-2 font-mono text-xs uppercase text-zinc-300 hover:border-red-400/70 hover:text-red-200"
                onClick={() => setPrompt("reset-confirm")}
                type="button"
              >
                Reset
              </button>
            ) : null}
            <button
              className="rounded border border-emerald-400/40 px-3 py-2 font-mono text-xs uppercase text-emerald-200 hover:bg-emerald-400/10"
              onClick={() => {
                playCue(audioRef, "select");
                setLogsOpen(true);
              }}
              type="button"
            >
              Logs
            </button>
          </div>
        </div>

        {mode === "select" ? (
          <CharacterSelect
            focusedIndex={focusedFighterIndex}
            onFocusIndex={setFocusedFighterIndex}
            onSelect={selectFighter}
            onStart={startGame}
            selectedFighter={selectedFighter}
            startBusy={startBusy}
          />
        ) : null}

        {mode === "arena" ? (
          <Arena
            completedLessonIds={completedLessonIds}
            onActivateLesson={activateLesson}
            player={player}
            selectedFighter={selectedFighter}
            setPlayer={setPlayer}
          />
        ) : null}

        {mode === "lesson" ? (
          <LessonPanel
            completed={completedLessonIds.has(activeLesson.id)}
            lesson={activeLesson}
            onBack={() => setMode("arena")}
            onComplete={completeLesson}
            onPdfReady={() => setPdfReady(true)}
            pdfReady={pdfReady}
            progressBusy={progressBusy}
            started={startedLessonIds.has(activeLesson.id)}
          />
        ) : null}

        <PromptPanel
          busy={progressBusy}
          error={progressError}
          onCancel={() => setPrompt(null)}
          onReset={confirmReset}
          prompt={prompt}
          promptCloseRef={promptCloseRef}
        />
      </div>

      <GameLogsDrawer
        lesson={activeLesson}
        onClose={() => setLogsOpen(false)}
        open={logsOpen}
        progress={progress}
        signedIn={signedIn}
      />
    </section>
  );
}

function CharacterSelect({
  focusedIndex,
  onFocusIndex,
  onSelect,
  onStart,
  selectedFighter,
  startBusy
}: {
  focusedIndex: number;
  onFocusIndex: (index: number) => void;
  onSelect: (fighter: GameFighter) => void;
  onStart: () => void;
  selectedFighter: GameFighter;
  startBusy: boolean;
}) {
  function onGridKey(event: ReactKeyboardEvent<HTMLDivElement>) {
    if (event.key === "ArrowRight" || event.key === "ArrowDown") {
      event.preventDefault();
      onFocusIndex((focusedIndex + 1) % GAME_FIGHTERS.length);
    }
    if (event.key === "ArrowLeft" || event.key === "ArrowUp") {
      event.preventDefault();
      onFocusIndex((focusedIndex - 1 + GAME_FIGHTERS.length) % GAME_FIGHTERS.length);
    }
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      void onSelect(GAME_FIGHTERS[focusedIndex]);
    }
  }

  return (
    <div className="grid gap-4 p-4">
      <div className="relative overflow-hidden rounded border border-zinc-800 bg-black/35 p-3">
        <div
          aria-label="Student select"
          className="relative grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-6"
          onKeyDown={onGridKey}
          role="listbox"
        >
          {GAME_FIGHTERS.map((fighter, index) => {
            const selected = selectedFighter.id === fighter.id;
            return (
              <button
                aria-selected={selected}
                className={`group rounded border bg-zinc-950/70 p-2 text-left transition focus:outline-none focus:ring-2 focus:ring-emerald-300/70 ${
                  selected ? "border-emerald-300/80 shadow-[0_0_24px_rgba(16,185,129,0.15)]" : "border-zinc-800 hover:border-zinc-500"
                }`}
                key={fighter.id}
                onClick={() => void onSelect(fighter)}
                onFocus={() => onFocusIndex(index)}
                role="option"
                tabIndex={index === focusedIndex ? 0 : -1}
                type="button"
              >
                <div className="relative flex aspect-[1.07] items-end justify-center overflow-hidden rounded bg-black/50">
                  <FighterModelPreview fighter={fighter} />
                </div>
                <p className="mt-2 truncate font-mono text-sm font-bold uppercase" style={{color: fighter.color}}>
                  {fighter.name}
                </p>
              </button>
            );
          })}
        </div>
      </div>
      <div className="flex justify-end rounded border border-zinc-800 bg-black/45 p-4">
        <button
          className="rounded border border-emerald-300/70 bg-emerald-400/15 px-5 py-3 font-mono text-sm font-bold uppercase text-emerald-100 hover:bg-emerald-400/25 disabled:opacity-50"
          disabled={startBusy}
          onClick={() => void onStart()}
          type="button"
        >
          {startBusy ? "Loading" : "Start lesson"}
        </button>
      </div>
    </div>
  );
}

function FighterModelPreview({fighter}: {fighter: GameFighter}) {
  const mountRef = useRef<HTMLDivElement | null>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let disposed = false;
    let renderer: WebGLRenderer | null = null;
    let scene: Scene | null = null;
    let camera: PerspectiveCamera | null = null;
    let model: Group | null = null;
    let animationFrame: number | null = null;

    async function setupPreview() {
      const mount = mountRef.current;
      if (!mount || !supportsWebGl()) {
        return;
      }
      const [THREE, {MTLLoader}, {OBJLoader}] = await Promise.all([
        import("three"),
        import("three/examples/jsm/loaders/MTLLoader.js"),
        import("three/examples/jsm/loaders/OBJLoader.js")
      ]);
      if (disposed || !mountRef.current) {
        return;
      }

      scene = new THREE.Scene();
      camera = new THREE.PerspectiveCamera(30, 1.1, 0.1, 40);
      camera.position.set(0, 0.35, 6.8);
      camera.lookAt(0, 0, 0);

      renderer = new THREE.WebGLRenderer({alpha: true, antialias: true});
      renderer.setClearColor(0x000000, 0);
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
      renderer.setSize(mount.clientWidth, mount.clientHeight, false);
      renderer.domElement.className = "absolute inset-0 h-full w-full";
      mount.append(renderer.domElement);

      const ambient = new THREE.AmbientLight(0xffffff, 3);
      const key = new THREE.DirectionalLight(0xffffff, 3.4);
      key.position.set(-2, 4, 5);
      const fill = new THREE.DirectionalLight(0x93c5fd, 1.6);
      fill.position.set(3, 1.5, 4);
      scene.add(ambient, key, fill);

      model = await loadObjModel({
        directory: fighter.model.directory,
        mtl: fighter.model.mtl,
        obj: fighter.model.obj,
        MTLLoader,
        OBJLoader
      });
      if (disposed || !scene || !model || !renderer || !camera) {
        return;
      }
      removeNonFighterMeshes(model, fighter.id);
      normalizeObject(THREE, model, CARD_FIGHTER_HEIGHT);
      alignObjectBottom(THREE, model, -1.08);
      model.rotation.y = fighter.model.rotationY;
      scene.add(model);
      setLoaded(true);

      const animate = () => {
        if (!renderer || !scene || !camera || !model) {
          return;
        }
        model.rotation.y += 0.0014;
        renderer.render(scene, camera);
        animationFrame = requestAnimationFrame(animate);
      };
      animate();
    }

    void setupPreview();

    return () => {
      disposed = true;
      if (animationFrame !== null) {
        cancelAnimationFrame(animationFrame);
      }
      if (renderer) {
        renderer.dispose();
        renderer.domElement.remove();
      }
      scene?.traverse((child) => {
        const mesh = child as Object3D & {
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
    };
  }, [fighter]);

  return (
    <div className="absolute inset-0" ref={mountRef}>
      {!loaded ? (
        <div className="grid h-full w-full place-items-center bg-[radial-gradient(circle_at_center,rgba(16,185,129,0.12),rgba(0,0,0,0.8)_58%)] font-mono text-[10px] uppercase tracking-wide text-zinc-600">
          loading model
        </div>
      ) : null}
    </div>
  );
}

function Arena({
  completedLessonIds,
  onActivateLesson,
  player,
  selectedFighter,
  setPlayer
}: {
  completedLessonIds: Set<GameLessonId>;
  onActivateLesson: (lessonId: GameLessonId) => void;
  player: PlayerState;
  selectedFighter: GameFighter;
  setPlayer: Dispatch<SetStateAction<PlayerState>>;
}) {
  function nudgePlayer(direction: 1 | -1) {
    setPlayer((current) => ({
      ...current,
      x: direction === -1 ? Math.max(PLAYER_MIN_X, current.x - 80) : Math.min(PLAYER_MAX_X, current.x + 80),
      facing: direction,
      moving: true
    }));
    window.setTimeout(() => {
      setPlayer((current) => ({...current, moving: false}));
    }, 180);
  }

  return (
    <div className="p-4">
      <div className="relative mx-auto h-[min(74vh,820px)] min-h-[560px] overflow-hidden rounded border border-zinc-700 bg-black">
        <ThreeArenaScene player={player} selectedFighter={selectedFighter} />
        {ORBS.map((orb) => {
          const lesson = getGameLesson(orb.lessonId);
          return (
            <button
              aria-label={`${lesson.title}, ${lesson.status}`}
              className="absolute h-24 w-24 -translate-x-1/2 -translate-y-1/2 rounded-full focus:outline-none focus:ring-2 focus:ring-emerald-300"
              key={lesson.id}
              onClick={() => onActivateLesson(lesson.id)}
              onFocus={() => {
                if (lesson.status === "locked") {
                  onActivateLesson(lesson.id);
                }
              }}
              onMouseEnter={() => {
                if (lesson.status === "locked") {
                  onActivateLesson(lesson.id);
                }
              }}
              style={{left: `${(orb.x / ARENA_WIDTH) * 100}%`, top: `${(orb.y / ARENA_HEIGHT) * 100}%`}}
              type="button"
            >
              <span className="absolute top-[72%] left-1/2 w-36 -translate-x-1/2 font-mono text-[10px] uppercase text-zinc-300">
                {completedLessonIds.has(lesson.id) ? "complete" : lesson.status}
              </span>
            </button>
          );
        })}
        <div className="absolute bottom-3 left-4 rounded border border-zinc-700 bg-black/55 px-3 py-2 font-mono text-xs uppercase text-zinc-300">
          {selectedFighter.name} / WASD or arrows / Space jump
        </div>
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        <button className="rounded border border-zinc-700 px-3 py-2 text-sm text-zinc-200" onClick={() => nudgePlayer(-1)} type="button">
          Left
        </button>
        <button className="rounded border border-zinc-700 px-3 py-2 text-sm text-zinc-200" onClick={() => nudgePlayer(1)} type="button">
          Right
        </button>
        <button className="rounded border border-zinc-700 px-3 py-2 text-sm text-zinc-200" onClick={() => setPlayer((current) => current.grounded ? {...current, vy: JUMP_VELOCITY, grounded: false} : current)} type="button">
          Jump
        </button>
        {GAME_LESSONS.map((lesson) => (
          <button className="rounded border border-emerald-400/40 px-3 py-2 text-sm text-emerald-200" key={lesson.id} onClick={() => onActivateLesson(lesson.id)} type="button">
            {lesson.status === "locked" ? "Check locked lesson" : "Open lesson"}
          </button>
        ))}
      </div>
    </div>
  );
}

function ThreeArenaScene({player, selectedFighter}: {player: PlayerState; selectedFighter: GameFighter}) {
  const mountRef = useRef<HTMLDivElement | null>(null);
  const playerStateRef = useRef(player);

  useEffect(() => {
    playerStateRef.current = player;
  }, [player]);

  useEffect(() => {
    let disposed = false;
    let renderer: WebGLRenderer | null = null;
    let scene: Scene | null = null;
    let camera: PerspectiveCamera | null = null;
    let animationFrame: number | null = null;
    let resizeObserver: ResizeObserver | null = null;
    let studentModel: Group | null = null;
    let unlockedOrb: Group | null = null;
    let lockedOrb: Group | null = null;
    let controls: OrbitControlsType | null = null;

    async function setupScene() {
      const mount = mountRef.current;
      if (!mount) {
        return;
      }
      const [THREE, {MTLLoader}, {OBJLoader}, {OrbitControls}] = await Promise.all([
        import("three"),
        import("three/examples/jsm/loaders/MTLLoader.js"),
        import("three/examples/jsm/loaders/OBJLoader.js"),
        import("three/examples/jsm/controls/OrbitControls.js")
      ]);
      if (disposed || !mountRef.current) {
        return;
      }

      scene = new THREE.Scene();
      camera = new THREE.PerspectiveCamera(31, 16 / 9, 0.1, 180);
      camera.position.set(0, 3.2, 23.5);
      camera.lookAt(0, 0.15, 0);

      renderer = new THREE.WebGLRenderer({alpha: true, antialias: true});
      renderer.setClearColor(0x000000, 0);
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
      renderer.domElement.className = "absolute inset-0 h-full w-full";
      mount.append(renderer.domElement);

      controls = new OrbitControls(camera, renderer.domElement);
      controls.enableDamping = true;
      controls.enablePan = true;
      controls.enableRotate = false;
      controls.minDistance = 15;
      controls.maxDistance = 28;
      controls.minPolarAngle = Math.PI * 0.2;
      controls.maxPolarAngle = Math.PI * 0.48;
      controls.minAzimuthAngle = -Math.PI * 0.16;
      controls.maxAzimuthAngle = Math.PI * 0.16;
      controls.target.set(0, 0.15, 0);

      const ambient = new THREE.AmbientLight(0xffffff, 2.3);
      const key = new THREE.DirectionalLight(0xffffff, 2.6);
      key.position.set(-4, 6, 7);
      const rim = new THREE.DirectionalLight(0x86efac, 1.2);
      rim.position.set(4, 2, -4);
      scene.add(ambient, key, rim);
      scene.add(createSpaceBackdrop(THREE));

      const platform = await loadObjModel({
        directory: "/game/assets/models/objects/platform/",
        mtl: "final_destination.mtl",
        obj: "final_destination.obj",
        MTLLoader,
        OBJLoader
      });
      if (disposed || !scene) {
        return;
      }
      normalizeObject(THREE, platform, 12.4);
      platform.scale.y *= 0.16;
      platform.rotation.set(0.08, 0, 0);
      alignObjectTop(THREE, platform, PLATFORM_TOP_Y);
      scene.add(platform);

      unlockedOrb = await loadObjModel({
        directory: "/game/assets/models/objects/smash-ball/",
        mtl: "ItmSmashBall.mtl",
        obj: "ItmSmashBall.obj",
        MTLLoader,
        OBJLoader
      });
      if (disposed || !scene || !unlockedOrb) {
        return;
      }
      normalizeObject(THREE, unlockedOrb, 0.95);
      unlockedOrb.position.set(screenXToWorld(ORBS[0].x), ORB_MODEL_Y, 0.18);
      scene.add(unlockedOrb);

      lockedOrb = unlockedOrb.clone();
      lockedOrb.position.set(screenXToWorld(ORBS[1].x), ORB_MODEL_Y, 0.18);
      lockedOrb.traverse((child) => {
        const mesh = child as Object3D & {material?: Material | Material[]};
        if (!mesh.material) {
          return;
        }
        const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
        const tinted = materials.map((original) => {
          const material = original.clone() as Material & {color?: {set: (color: number) => void}};
          material.color?.set(0x9ca3af);
          material.opacity = 0.45;
          material.transparent = true;
          return material;
        });
        if (Array.isArray(mesh.material)) {
          mesh.material = tinted;
        } else {
          mesh.material = tinted[0];
        }
      });
      scene.add(lockedOrb);

      studentModel = await loadObjModel({
        directory: selectedFighter.model.directory,
        mtl: selectedFighter.model.mtl,
        obj: selectedFighter.model.obj,
        MTLLoader,
        OBJLoader
      });
      if (disposed || !scene || !studentModel) {
        return;
      }
      removeNonFighterMeshes(studentModel, selectedFighter.id);
      normalizeObject(THREE, studentModel, ARENA_FIGHTER_HEIGHT);
      studentModel.rotation.y = selectedFighter.model.rotationY;
      alignObjectBottom(THREE, studentModel, PLATFORM_TOP_Y + 0.03);
      scene.add(studentModel);

      const resize = () => {
        if (!mountRef.current || !renderer || !camera) {
          return;
        }
        const rect = mountRef.current.getBoundingClientRect();
        renderer.setSize(rect.width, rect.height, false);
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
        if (studentModel) {
          const current = playerStateRef.current;
          studentModel.position.x = screenXToWorld(current.x);
          alignObjectBottom(THREE, studentModel, PLATFORM_TOP_Y + 0.03 + ((GROUND_Y - current.y) / GROUND_Y) * 2.2);
          studentModel.rotation.y = selectedFighter.model.rotationY + playerFacingRotation(current);
        }
        controls?.update();
        renderer.render(scene, camera);
        animationFrame = requestAnimationFrame(animate);
      };
      animate();
    }

    void setupScene();

    return () => {
      disposed = true;
      if (animationFrame !== null) {
        cancelAnimationFrame(animationFrame);
      }
      resizeObserver?.disconnect();
      if (renderer) {
        renderer.dispose();
        renderer.domElement.remove();
      }
      controls?.dispose();
      scene?.traverse((child) => {
        const mesh = child as Object3D & {
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
    };
  }, [selectedFighter]);

  return (
    <div
      aria-hidden="true"
      className="absolute inset-0 overflow-hidden bg-black"
      ref={mountRef}
    />
  );
}

async function loadObjModel({
  directory,
  MTLLoader,
  mtl,
  obj,
  OBJLoader
}: {
  directory: string;
  MTLLoader: typeof import("three/examples/jsm/loaders/MTLLoader.js").MTLLoader;
  mtl: string;
  obj: string;
  OBJLoader: typeof import("three/examples/jsm/loaders/OBJLoader.js").OBJLoader;
}) {
  const materialLoader = new MTLLoader();
  materialLoader.setPath(directory);
  const materials = await materialLoader.loadAsync(mtl);
  materials.preload();

  const objectLoader = new OBJLoader();
  objectLoader.setPath(directory);
  objectLoader.setMaterials(materials);
  return objectLoader.loadAsync(obj);
}

function normalizeObject(THREE: typeof import("three"), object: Object3D, targetHeight: number) {
  const box = new THREE.Box3().setFromObject(object);
  const size = box.getSize(new THREE.Vector3());
  const center = box.getCenter(new THREE.Vector3());
  const scale = targetHeight / Math.max(size.x, size.y, size.z, 0.001);
  object.scale.setScalar(scale);
  object.position.sub(center.multiplyScalar(scale));
}

function alignObjectTop(THREE: typeof import("three"), object: Object3D, topY: number) {
  object.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(object);
  object.position.y += topY - box.max.y;
}

function alignObjectBottom(THREE: typeof import("three"), object: Object3D, bottomY: number) {
  object.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(object);
  object.position.y += bottomY - box.min.y;
}

function createSpaceBackdrop(THREE: typeof import("three")) {
  const group = new THREE.Group();
  const starVertices: number[] = [];
  for (let index = 0; index < 1200; index += 1) {
    starVertices.push(THREE.MathUtils.randFloatSpread(80), THREE.MathUtils.randFloatSpread(48), -18 - Math.random() * 70);
  }
  const starGeometry = new THREE.BufferGeometry();
  starGeometry.setAttribute("position", new THREE.Float32BufferAttribute(starVertices, 3));
  const stars = new THREE.Points(
    starGeometry,
    new THREE.PointsMaterial({color: 0xdbeafe, opacity: 0.82, size: 0.055, transparent: true})
  );
  group.add(stars);
  return group;
}

function removeNonFighterMeshes(model: Object3D, fighterId: GameFighterId) {
  const helperNames = [
    "batwin",
    "barrel",
    "bf_",
    "bomb",
    "boomerang",
    "egg",
    "fireball",
    "hat_",
    "hookshot",
    "inhale",
    "intro",
    "light_",
    "pkfire",
    "pokeball",
    "stone",
    "teleport",
    "tounge",
    "tongue",
    "yoyo"
  ];
  const removable: Object3D[] = [];
  model.traverse((child) => {
    const name = child.name.toLowerCase();
    if (
      helperNames.some((helperName) => name.includes(helperName)) ||
      fighterSpecificHelperNames(fighterId).some((helperName) => name.includes(helperName)) ||
      !isBaseFighterMesh(name, fighterId)
    ) {
      removable.push(child);
    }
  });
  for (const child of removable) {
    child.parent?.remove(child);
  }
}

function fighterSpecificHelperNames(fighterId: GameFighterId) {
  const helpers: Partial<Record<GameFighterId, string[]>> = {
    jigglypuff: ["4a8a0a50", "65988d95", "4ec2cd09", "4365faf5"],
    kirby: ["775209d4"],
    samus: ["72ec6bab", "34feeed9"]
  };
  return helpers[fighterId] ?? [];
}

function isBaseFighterMesh(name: string, fighterId: GameFighterId) {
  if (!name) {
    return true;
  }
  if (fighterId === "yoshi") {
    return true;
  }
  const basePrefixes: Partial<Record<GameFighterId, string[]>> = {
    "captain-falcon": ["arm", "body", "hand", "head", "leg"],
    "donkey-kong": ["arm", "body", "hand", "head", "leg"],
    fox: ["nemu"],
    jigglypuff: ["nemu"],
    kirby: ["nemu"],
    link: ["arm", "body", "hand", "head", "leg", "shield", "sword"],
    luigi: ["arm", "body", "hand", "head", "leg"],
    mario: ["arm", "body", "hand", "head", "leg"],
    ness: ["arm", "body", "hand", "head", "leg"],
    pikachu: ["arm", "body", "head", "leg", "tail"],
    samus: ["nemu"]
  };
  return (basePrefixes[fighterId] ?? []).some((prefix) => name.startsWith(prefix));
}

function screenXToWorld(x: number) {
  return (x / ARENA_WIDTH - 0.5) * 9.2;
}

function playerFacingRotation(player: PlayerState) {
  if (!player.moving) {
    return 0;
  }
  return player.facing === -1 ? -Math.PI / 2 : Math.PI / 2;
}

function supportsWebGl() {
  if (typeof document === "undefined") {
    return false;
  }
  const canvas = document.createElement("canvas");
  return Boolean(canvas.getContext("webgl") ?? canvas.getContext("experimental-webgl"));
}

function LessonPanel({
  completed,
  lesson,
  onBack,
  onComplete,
  onPdfReady,
  pdfReady,
  progressBusy,
  started
}: {
  completed: boolean;
  lesson: GameLesson;
  onBack: () => void;
  onComplete: () => void;
  onPdfReady: () => void;
  pdfReady: boolean;
  progressBusy: boolean;
  started: boolean;
}) {
  return (
    <div className="grid gap-4 p-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="font-mono text-xs uppercase text-emerald-300">Lesson 1</p>
          <h2 className="text-xl font-bold text-zinc-100">{lesson.title}</h2>
        </div>
        <button className="rounded border border-zinc-700 px-3 py-2 text-sm text-zinc-200 hover:border-zinc-500" onClick={onBack} type="button">
          Back
        </button>
      </div>
      <div className="relative min-h-[68vh] overflow-hidden rounded border border-zinc-700 bg-zinc-950">
        {!pdfReady ? (
          <div className="absolute inset-0 grid place-items-center bg-zinc-950 text-sm text-zinc-400">
            <span className="font-mono uppercase tracking-wide">Loading worksheet</span>
          </div>
        ) : null}
        {lesson.pdfUrl ? (
          <object className="h-[68vh] w-full" data={lesson.pdfUrl} onLoad={onPdfReady} type="application/pdf">
            <div className="grid h-[68vh] place-items-center p-6 text-center">
              <p className="mb-3 text-sm text-zinc-400">The worksheet preview could not load inline.</p>
              <a className="rounded border border-emerald-400/60 px-4 py-3 text-emerald-200" href={lesson.pdfUrl} rel="noreferrer" target="_blank">
                Open PDF
              </a>
            </div>
          </object>
        ) : null}
      </div>
      <div className="flex justify-end">
        <button
          className="rounded border border-emerald-300/70 bg-emerald-400/15 px-4 py-3 font-mono text-sm uppercase text-emerald-100 disabled:opacity-50"
          disabled={completed || progressBusy || !started}
          onClick={() => void onComplete()}
          type="button"
        >
          {completed ? "Completed" : progressBusy || !started ? "Saving" : "Complete Lesson"}
        </button>
      </div>
    </div>
  );
}

function PromptPanel({
  busy,
  error,
  onCancel,
  onReset,
  prompt,
  promptCloseRef
}: {
  busy: boolean;
  error: string | null;
  onCancel: () => void;
  onReset: () => void;
  prompt: Prompt;
  promptCloseRef: RefObject<HTMLButtonElement | null>;
}) {
  if (!prompt) {
    return null;
  }
  const copy = {
    login: ["Login required", "Login from the header to select a fighter and save progress."],
    locked: ["Locked lesson", "The dynamic generated lesson orb is reserved for a future sprint."],
    "save-failed": ["Progress did not save", error ?? "Try again after checking your session."],
    "reset-confirm": ["Reset progress", "This clears your selected fighter and completed lesson state."]
  }[prompt];
  return (
    <div className="fixed inset-0 z-[700] grid place-items-center bg-black/55 p-4 backdrop-blur-sm">
      <div aria-modal="true" className="w-full max-w-md rounded border border-zinc-700 bg-[#080b12] p-5 shadow-2xl" role="dialog">
        <h2 className="font-mono text-lg font-bold uppercase text-zinc-100">{copy[0]}</h2>
        <p className="mt-2 text-sm leading-6 text-zinc-300">{copy[1]}</p>
        <div className="mt-5 flex justify-end gap-2">
          <button className="rounded border border-zinc-700 px-3 py-2 text-sm text-zinc-200" onClick={onCancel} ref={promptCloseRef} type="button">
            Close
          </button>
          {prompt === "reset-confirm" ? (
            <button className="rounded border border-red-400/50 bg-red-500/10 px-3 py-2 text-sm text-red-100" disabled={busy} onClick={() => void onReset()} type="button">
              {busy ? "Resetting" : "Reset progress"}
            </button>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function GameLogsDrawer({
  lesson,
  onClose,
  open,
  progress,
  signedIn
}: {
  lesson: GameLesson;
  onClose: () => void;
  open: boolean;
  progress: GameProgress;
  signedIn: boolean;
}) {
  if (!open) {
    return null;
  }
  return (
    <aside className="fixed inset-y-0 right-0 z-[500] flex w-full max-w-md flex-col border-l border-emerald-400/20 bg-[#05070b]/95 p-4 shadow-2xl backdrop-blur-md sm:top-20 sm:h-[calc(100vh-5rem)]">
      <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
        <div>
          <p className="font-mono text-xs uppercase text-emerald-300">Game logs</p>
          <h2 className="font-mono text-lg font-bold uppercase">{lesson.title}</h2>
        </div>
        <button className="rounded border border-zinc-700 px-3 py-2 text-sm text-zinc-200" onClick={onClose} type="button">
          Close
        </button>
      </div>
      <div className="mt-4 overflow-y-auto pr-1">
        <div className="rounded border border-zinc-800 bg-black/40 p-3">
          <p className="font-mono text-xs uppercase text-zinc-500">Viewer</p>
          <p className="mt-1 text-sm text-zinc-200">{signedIn ? "authenticated progress enabled" : "public read-only shell"}</p>
          <p className="mt-1 font-mono text-xs text-zinc-500">{progress.lessons.length} progress row(s)</p>
        </div>
        <div className="mt-3 grid gap-3">
          {lesson.logSummary.map((stage) => (
            <article className="rounded border border-zinc-800 bg-black/35 p-3" key={stage.id}>
              <div className="flex items-center justify-between gap-3">
                <h3 className="font-mono text-sm font-bold uppercase text-emerald-200">{stage.label}</h3>
                <span className="rounded border border-zinc-700 px-2 py-1 font-mono text-[10px] uppercase text-zinc-400">{stage.status}</span>
              </div>
              <p className="mt-3 text-sm leading-6 text-zinc-200">{stage.summary}</p>
              <dl className="mt-3 grid gap-2 text-xs">
                <div>
                  <dt className="font-mono uppercase text-zinc-500">Inputs</dt>
                  <dd className="text-zinc-300">{stage.inputs}</dd>
                </div>
                <div>
                  <dt className="font-mono uppercase text-zinc-500">Outputs</dt>
                  <dd className="text-zinc-300">{stage.outputs}</dd>
                </div>
              </dl>
            </article>
          ))}
        </div>
      </div>
    </aside>
  );
}

async function accessToken() {
  const supabase = createClient();
  const {
    data: {session}
  } = await supabase.auth.getSession();
  return session?.access_token ?? null;
}

function intersectsOrb(player: PlayerState, orb: {x: number; y: number}) {
  const playerCenterX = player.x;
  const playerCenterY = player.y - PLAYER_HEIGHT / 2;
  const distance = Math.hypot(playerCenterX - orb.x, playerCenterY - orb.y);
  return distance < 58;
}

function playCue(audioRef: RefObject<Partial<Record<GameAudioCueId, HTMLAudioElement>>>, cue: GameAudioCueId) {
  const element = audioRef.current[cue];
  if (!element) {
    return;
  }
  element.currentTime = 0;
  void element.play().catch(() => {
    // Browsers may block audio until a user gesture; gameplay continues without sound.
  });
}

function readGameSession() {
  if (typeof window === "undefined") {
    return null;
  }
  try {
    const raw = window.sessionStorage.getItem(GAME_SESSION_KEY);
    if (!raw) {
      return null;
    }
    const parsed = JSON.parse(raw) as {mode?: GameMode; selectedFighterId?: GameFighterId};
    if (!parsed.mode || !["select", "arena", "lesson"].includes(parsed.mode)) {
      return null;
    }
    return {
      mode: parsed.mode,
      selectedFighterId: getFighter(parsed.selectedFighterId).id
    };
  } catch {
    return null;
  }
}

function writeGameSession(session: {mode: GameMode; selectedFighterId: GameFighterId}) {
  if (typeof window === "undefined") {
    return;
  }
  window.sessionStorage.setItem(GAME_SESSION_KEY, JSON.stringify(session));
}
