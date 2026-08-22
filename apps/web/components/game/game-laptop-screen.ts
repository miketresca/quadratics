import type {CurrentUser} from "@quadratics/types";
import type {Object3D} from "three";
import type {CSS3DObject} from "three/examples/jsm/renderers/CSS3DRenderer.js";

import type {GameLessonArtifact, GameLessonStage} from "@/lib/api";

import {
  GAME_LESSON_DEFAULT_INSTRUCTOR_LABEL,
  GAME_LESSON_STAGES,
  artifactForStage,
  artifactPreviewRows,
  artifactPreviewText,
  gameStageDetails,
  gameStageMetaLine,
  pipelineDependencyMessage,
  shortRunId,
  stagePalette,
  statusColor
} from "./game-pipeline-utils";
import {accountDisplayName, escapeHtml} from "./game-auth-utils";
import {clampMusicVolume} from "./game-runtime-storage";
import type {SceneTunableName} from "./game-types";
import {
  MUSIC_OPTIONS,
  formatQuantity,
  formatUsd,
  musicEmbedUrl,
  type LaptopCostState,
  type LaptopDisplayTab,
  type LaptopPipelineState,
  type LaptopTab,
  type MusicOptionId,
  type MusicState
} from "./game-laptop-panels";

export function createLaptopScreen(
  CSS3DObjectClass: typeof CSS3DObject,
  options: {
    costs: LaptopCostState;
    error: string | null;
    musicMuted: boolean;
    onApproveArtifact: (artifact: GameLessonArtifact) => void;
    onCreateRun: () => void;
    onResetProgress: () => void;
    onRunStage: (stage: GameLessonStage, options?: {force?: boolean}) => void;
    onSaveArtifact: (artifact: GameLessonArtifact, payload: Record<string, unknown>) => void;
    onSignIn: (formData: FormData) => Promise<void>;
    onSignOut: () => Promise<void>;
    onMusicChange: (selectedMusicId: MusicOptionId) => void;
    onMusicMutedChange: (muted: boolean) => void;
    onMusicVolumeChange: (volume: number) => void;
    onTabChange: (tab: LaptopDisplayTab) => void;
    origin: string;
    pipeline: LaptopPipelineState;
    musicVolume: number;
    selectedMusicId: MusicOptionId;
    tab: LaptopDisplayTab;
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

  // Keep YouTube mounted off-screen so tab switches do not restart or duplicate audio.
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
  let currentTab: LaptopDisplayTab = options.tab;
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
      appRoot.append(renderSignedOutLaptopBrowser({
        error: currentError,
        iframe,
        loading,
        musicMuted: currentMusicMuted,
        musicVolume: currentMusicVolume,
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
        onSignIn: options.onSignIn,
        onTabChange: (tab) => {
          currentTab = tab;
          render();
          options.onTabChange(tab);
        },
        selectedMusicId: currentMusicId,
        tab: currentTab === "music" ? "music" : "signin"
      }));
      applyMusicPlaybackState();
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
      onSaveArtifact: options.onSaveArtifact,
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
      tab: currentTab === "signin" ? "demo" : currentTab,
      user: currentUser
    }));
    applyMusicPlaybackState();
  }
  render();

  const object = new CSS3DObjectClass(screen);
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
      setTab(tab: LaptopDisplayTab) {
        currentTab = tab;
        render();
      },
      updateUser(user: CurrentUser | null) {
        currentUser = user;
        currentError = null;
        currentTab = user ? "demo" : "signin";
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
  onSaveArtifact,
  pipeline
}: {
  onApproveArtifact: (artifact: GameLessonArtifact) => void;
  onCreateRun: () => void;
  onResetProgress: () => void;
  onRunStage: (stage: GameLessonStage, options?: {force?: boolean}) => void;
  onSaveArtifact: (artifact: GameLessonArtifact, payload: Record<string, unknown>) => void;
  pipeline: LaptopPipelineState;
}) {
  void onSaveArtifact;
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
    <a href="/game/lessons/volume-cubes/task-lesson.pdf" target="_blank" rel="noreferrer" style="display:inline-flex;margin-top:10px;border:1px solid rgba(103,232,249,.32);background:rgba(8,47,73,.22);border-radius:8px;padding:7px 10px;color:#cffafe;font-size:10px;font-weight:900;letter-spacing:.12em;text-transform:uppercase;text-decoration:none">Open reference PDF</a>
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

function renderSignedOutLaptopBrowser({
  error,
  iframe,
  loading,
  musicMuted,
  musicVolume,
  onMusicChange,
  onMusicMutedChange,
  onMusicVolumeChange,
  onSignIn,
  onTabChange,
  selectedMusicId,
  tab
}: {
  error: string | null;
  iframe: HTMLIFrameElement;
  loading: boolean;
  musicMuted: boolean;
  musicVolume: number;
  onMusicChange: (selectedMusicId: MusicOptionId) => void;
  onMusicMutedChange: (muted: boolean) => void;
  onMusicVolumeChange: (volume: number) => void;
  onSignIn: (formData: FormData) => Promise<void>;
  onTabChange: (tab: LaptopDisplayTab) => void;
  selectedMusicId: MusicOptionId;
  tab: "signin" | "music";
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
    ["signin", "Sign in"],
    ["music", "Music"]
  ] as Array<["signin" | "music", string]>) {
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
    button.addEventListener("pointerdown", (event) => event.stopPropagation());
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
    const musicBrowser = renderLaptopBrowser({
      costs: {error: null, events: [], loading: false, summary: null},
      iframe,
      musicMuted,
      musicVolume,
      onApproveArtifact: () => undefined,
      onCreateRun: () => undefined,
      onMusicChange,
      onMusicMutedChange,
      onMusicVolumeChange,
      onResetProgress: () => undefined,
      onRunStage: () => undefined,
      onSaveArtifact: () => undefined,
      onSignOut: async () => undefined,
      onTabChange,
      pipeline: {error: null, loading: false, loadingStage: null, run: null},
      selectedMusicId,
      tab: "music",
      user: {creditBalance: 0, displayName: "guest", email: null, id: "guest"}
    });
    const musicBody = musicBrowser.lastElementChild;
    if (musicBody instanceof HTMLElement) {
      body.replaceWith(musicBody);
      wrap.append(musicBody);
      return wrap;
    }
  } else {
    body.append(renderLaptopLogin({error, loading, onSignIn}));
  }
  wrap.append(body);
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
  onSaveArtifact,
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
  onSaveArtifact: (artifact: GameLessonArtifact, payload: Record<string, unknown>) => void;
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
    body.append(renderLaptopPipeline({onApproveArtifact, onCreateRun, onResetProgress, onRunStage, onSaveArtifact, pipeline}));
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

export function formatSceneTransform(name: SceneTunableName, object: Object3D) {
  const position = [object.position.x, object.position.y, object.position.z].map((value) => value.toFixed(3)).join(", ");
  const rotation = [object.rotation.x, object.rotation.y, object.rotation.z].map((value) => value.toFixed(3)).join(", ");
  const scale = [object.scale.x, object.scale.y, object.scale.z].map((value) => value.toFixed(3)).join(", ");
  return `${name}
position.set(${position})
rotation.set(${rotation})
scale.set(${scale})`;
}
