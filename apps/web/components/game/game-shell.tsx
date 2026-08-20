"use client";

import type {CurrentUser, GameFighterId, GameLessonId, GameProgress} from "@quadratics/types";
import type {CSSProperties, Dispatch, KeyboardEvent as ReactKeyboardEvent, RefObject, SetStateAction} from "react";
import {useCallback, useEffect, useMemo, useRef, useState} from "react";

import {GAME_AUDIO_CUES, GAME_FIGHTERS, getAsset, getFighter, type GameAudioCueId, type GameFighter} from "@/lib/game/assets";
import {GAME_LESSONS, getGameLesson, type GameLesson} from "@/lib/game/lessons";
import {getGameProgress, resetGameProgress, updateGameProgress} from "@/lib/game/progress-client";
import {createClient} from "@/lib/supabase/client";

type GameMode = "select" | "arena" | "lesson";
type Prompt = "login" | "locked" | "save-failed" | "reset-confirm" | null;
type PlayerState = {x: number; y: number; vy: number; grounded: boolean; facing: 1 | -1};

const ARENA_WIDTH = 960;
const ARENA_HEIGHT = 540;
const GROUND_Y = 388;
const PLAYER_WIDTH = 76;
const PLAYER_HEIGHT = 92;
const SPEED = 5.6;
const GRAVITY = 0.72;
const JUMP_VELOCITY = -14;
const ORBS = [
  {lessonId: "volume-cubes-lesson-1" as const, x: 360, y: 150},
  {lessonId: "dynamic-lesson-locked" as const, x: 600, y: 150}
];

export function GameShell({initialUser}: {initialUser: CurrentUser | null}) {
  const [mode, setMode] = useState<GameMode>("select");
  const [prompt, setPrompt] = useState<Prompt>(null);
  const [selectedFighterId, setSelectedFighterId] = useState<GameFighterId | null>("captain-falcon");
  const [focusedFighterIndex, setFocusedFighterIndex] = useState(0);
  const [activeLessonId, setActiveLessonId] = useState<GameLessonId>("volume-cubes-lesson-1");
  const [progress, setProgress] = useState<GameProgress>({selectedFighterId: null, lessons: []});
  const [progressError, setProgressError] = useState<string | null>(null);
  const [progressBusy, setProgressBusy] = useState(false);
  const [startBusy, setStartBusy] = useState(false);
  const [logsOpen, setLogsOpen] = useState(false);
  const [player, setPlayer] = useState<PlayerState>({x: 448, y: GROUND_Y, vy: 0, grounded: true, facing: 1});
  const [pdfReady, setPdfReady] = useState(false);
  const keysRef = useRef(new Set<string>());
  const frameRef = useRef<number | null>(null);
  const collisionLessonRef = useRef<GameLessonId | null>(null);
  const playerRef = useRef<PlayerState>({x: 448, y: GROUND_Y, vy: 0, grounded: true, facing: 1});
  const progressRequestRef = useRef(0);
  const startBusyRef = useRef(false);
  const promptCloseRef = useRef<HTMLButtonElement | null>(null);
  const audioRef = useRef<Partial<Record<GameAudioCueId, HTMLAudioElement>>>({});
  const signedIn = initialUser !== null;
  const selectedFighter = getFighter(selectedFighterId);
  const activeLesson = getGameLesson(activeLessonId);

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
    const playIntro = () => playCue(audioRef, "choose");
    window.addEventListener("pointerdown", playIntro, {once: true});
    window.addEventListener("keydown", playIntro, {once: true});
    return () => {
      window.removeEventListener("pointerdown", playIntro);
      window.removeEventListener("keydown", playIntro);
    };
  }, []);

  useEffect(() => {
    if (mode !== "select") {
      return;
    }
    function startOnSpace(event: KeyboardEvent) {
      if (event.key === " " && !event.repeat && !prompt && !isEditableOrControlTarget(event.target)) {
        event.preventDefault();
        void startGame();
      }
    }
    window.addEventListener("keydown", startOnSpace);
    return () => window.removeEventListener("keydown", startOnSpace);
  }, [mode, prompt, selectedFighterId, signedIn]);

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
        if (keys.has("arrowleft") || keys.has("a")) {
          nextX -= SPEED;
          facing = -1;
        }
        if (keys.has("arrowright") || keys.has("d")) {
          nextX += SPEED;
          facing = 1;
        }
        if ((keys.has(" ") || keys.has("arrowup") || keys.has("w")) && current.grounded) {
          nextVy = JUMP_VELOCITY;
          playCue(audioRef, "jump");
        }
        const nextY = current.y + nextVy;
        nextVy += GRAVITY;
        const grounded = nextY >= GROUND_Y;
        const boundedX = Math.max(130, Math.min(ARENA_WIDTH - 130 - PLAYER_WIDTH, nextX));
        const resolvedY = grounded ? GROUND_Y : nextY;
        const next = {x: boundedX, y: resolvedY, vy: grounded ? 0 : nextVy, grounded, facing};
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
  }, [mode]);

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
    <section className="mx-auto flex min-h-screen w-full max-w-6xl flex-col px-4 pb-16 pt-28 sm:px-6">
      <div className="game-stage-shell relative overflow-hidden rounded border border-zinc-800 bg-[#030508]/86 shadow-[0_0_40px_rgba(16,185,129,0.08)]">
        <div className="flex items-center justify-between border-b border-zinc-800/80 px-4 py-3">
          <div>
            <p className="font-mono text-xs uppercase tracking-wide text-emerald-300">Quadratics Game Lab</p>
            <h1 className="font-mono text-xl font-bold tracking-wide text-zinc-100 sm:text-2xl">Choose your student</h1>
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
                <div className="flex aspect-[1.07] items-end justify-center overflow-hidden rounded bg-black/50">
                  <SheetPortrait className="h-full w-full" fighter={fighter} />
                </div>
                <p className="mt-2 truncate font-mono text-sm font-bold uppercase" style={{color: fighter.color}}>
                  {fighter.name}
                </p>
                <p className="font-mono text-[10px] uppercase tracking-wide text-zinc-500">student slot</p>
              </button>
            );
          })}
        </div>
      </div>
      <div className="grid gap-4 rounded border border-zinc-800 bg-black/45 p-4 md:grid-cols-[1fr_auto] md:items-center">
        <div className="grid gap-3 sm:grid-cols-[auto_1fr] sm:items-center">
          <p className="font-mono text-xs uppercase text-zinc-500">1P slot</p>
          <div className="flex min-h-24 items-center gap-4 rounded border border-zinc-700 bg-zinc-950/80 p-3">
            <SheetPortrait className="h-20 w-24 rounded" fighter={selectedFighter} />
            <div>
              <p className="font-mono text-xl font-bold uppercase text-zinc-100">{selectedFighter.shortName}</p>
              <p className="font-mono text-xs uppercase text-emerald-300">ready for lesson</p>
            </div>
          </div>
        </div>
        <button
          className="rounded border border-emerald-300/70 bg-emerald-400/15 px-5 py-3 font-mono text-sm font-bold uppercase text-emerald-100 hover:bg-emerald-400/25 disabled:opacity-50"
          disabled={startBusy}
          onClick={() => void onStart()}
          type="button"
        >
          {startBusy ? "Loading" : "Press Space"}
        </button>
      </div>
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
  return (
    <div className="p-4">
      <div className="relative mx-auto aspect-video max-h-[70vh] overflow-hidden rounded border border-zinc-700 bg-black">
        <img alt="" className="absolute inset-0 h-full w-full object-cover" src="/game/assets/backgrounds/final-destination.svg" />
        {ORBS.map((orb) => {
          const lesson = getGameLesson(orb.lessonId);
          const asset = getAsset(lesson.orbAssetId);
          return (
            <button
              aria-label={`${lesson.title}, ${lesson.status}`}
              className="absolute h-20 w-20 -translate-x-1/2 -translate-y-1/2 rounded-full focus:outline-none focus:ring-2 focus:ring-emerald-300"
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
              <img alt="" className="h-full w-full animate-pulse object-contain" src={asset.src} />
              <span className="absolute -bottom-5 left-1/2 w-36 -translate-x-1/2 font-mono text-[10px] uppercase text-zinc-300">
                {completedLessonIds.has(lesson.id) ? "complete" : lesson.status}
              </span>
            </button>
          );
        })}
        <SheetPortrait
          className="absolute h-[17%] w-[13%]"
          fighter={selectedFighter}
          style={{
            left: `${(player.x / ARENA_WIDTH) * 100}%`,
            top: `${(player.y / ARENA_HEIGHT) * 100}%`,
            transform: `translate(-50%, -100%) scaleX(${player.facing})`
          }}
        />
        <div className="absolute bottom-3 left-4 rounded border border-zinc-700 bg-black/55 px-3 py-2 font-mono text-xs uppercase text-zinc-300">
          {selectedFighter.name} / WASD or arrows / Space jump
        </div>
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        <button className="rounded border border-zinc-700 px-3 py-2 text-sm text-zinc-200" onClick={() => setPlayer((current) => ({...current, x: Math.max(130, current.x - 80), facing: -1}))} type="button">
          Left
        </button>
        <button className="rounded border border-zinc-700 px-3 py-2 text-sm text-zinc-200" onClick={() => setPlayer((current) => ({...current, x: Math.min(ARENA_WIDTH - 130 - PLAYER_WIDTH, current.x + 80), facing: 1}))} type="button">
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

function SheetPortrait({
  className,
  fighter,
  style
}: {
  className?: string;
  fighter: GameFighter;
  style?: CSSProperties;
}) {
  const sheet = getAsset("character-select-screen");
  const positionX = (fighter.portrait.x / (sheet.width - fighter.portrait.width)) * 100;
  const positionY = (fighter.portrait.y / (sheet.height - fighter.portrait.height)) * 100;
  return (
    <div
      aria-hidden="true"
      className={`overflow-hidden bg-no-repeat [image-rendering:pixelated] ${className ?? ""}`}
      style={{
        backgroundImage: `url(${sheet.src})`,
        backgroundPosition: `${positionX}% ${positionY}%`,
        backgroundSize: `${(sheet.width / fighter.portrait.width) * 100}% ${(sheet.height / fighter.portrait.height) * 100}%`,
        ...style
      }}
    />
  );
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

function isEditableOrControlTarget(target: EventTarget | null) {
  if (!(target instanceof HTMLElement)) {
    return false;
  }
  return Boolean(target.closest("button, input, textarea, select, summary, a, [contenteditable='true']"));
}
