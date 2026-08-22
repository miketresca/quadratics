import type {GameLessonArtifact, GameLessonStage, GameWorksheetRunSnapshot} from "@/lib/api";

export const GAME_LESSON_DEFAULT_INSTRUCTOR_LABEL = "Male Instructor";

export const GAME_LESSON_STAGES: Array<{label: string; stage: GameLessonStage}> = [
  {stage: "template", label: "Template"},
  {stage: "section_script", label: "Section script"},
  {stage: "speech_markup", label: "Speech markup"},
  {stage: "narration", label: "Narration"},
  {stage: "handwriting", label: "Handwriting"},
  {stage: "interactive_bundle", label: "Interactive bundle"},
  {stage: "lesson_publish", label: "Lesson publish"}
];

export function artifactForStage(run: GameWorksheetRunSnapshot | null, stage: GameLessonStage): GameLessonArtifact | null {
  return run?.artifacts.find((artifact) => artifact.stage === stage && artifact.isCurrent) ?? null;
}

export function isGameLessonPublished(run: GameWorksheetRunSnapshot | null) {
  const artifact = artifactForStage(run, "lesson_publish");
  return artifact?.status === "completed" || artifact?.status === "approved";
}

export function pipelineDependencyMessage(run: GameWorksheetRunSnapshot | null, stage: GameLessonStage) {
  if (!run && stage !== "template") {
    return "Create the Lesson 1 run first.";
  }
  if (stage === "template") {
    return null;
  }
  const stageIndex = GAME_LESSON_STAGES.findIndex((item) => item.stage === stage);
  const previousStage = GAME_LESSON_STAGES[stageIndex - 1]?.stage;
  const previousArtifact = previousStage ? artifactForStage(run, previousStage) : null;
  if (!previousArtifact || !["completed", "approved"].includes(previousArtifact.status)) {
    return `Requires completed ${previousStage}.`;
  }
  if (stage === "speech_markup" && previousArtifact.status !== "approved") {
    return "Approve section script first.";
  }
  if (stage === "narration") {
    const markup = artifactForStage(run, "speech_markup");
    if (markup?.status !== "approved") {
      return "Approve speech markup first.";
    }
  }
  return null;
}

export function shortRunId(id: string) {
  return id.slice(0, 8);
}

export function gameStageMetaLine(artifact: GameLessonArtifact | null, fallbackStatus: string) {
  const parts = [fallbackStatus.replaceAll("_", " ")];
  if (artifact) {
    parts.push(`v${artifact.version}`);
    const timestamp = artifact.completedAt ?? artifact.createdAt;
    if (timestamp) {
      parts.push(`last ran ${formatPipelineTimestamp(timestamp)}`);
    }
    if (artifact.providerName) {
      parts.push(artifact.providerName);
    }
    if (artifact.modelName) {
      parts.push(artifact.modelName);
    }
  }
  return parts.join(" / ");
}

export function statusTextClass(status?: string) {
  if (status === "completed" || status === "approved") {
    return "text-emerald-200";
  }
  if (status === "failed" || status === "rejected") {
    return "text-red-200";
  }
  if (status === "stale") {
    return "text-amber-200";
  }
  if (status === "running") {
    return "text-cyan-200";
  }
  if (status === "awaiting_approval") {
    return "text-violet-200";
  }
  return "text-zinc-300";
}

export function stagePalette(stage: GameLessonStage) {
  const palettes: Record<GameLessonStage, {border: string; glow: string; text: string}> = {
    template: {border: "rgba(52,211,153,0.42)", glow: "rgba(16,185,129,0.08)", text: "#a7f3d0"},
    section_script: {border: "rgba(56,189,248,0.46)", glow: "rgba(14,165,233,0.08)", text: "#bae6fd"},
    speech_markup: {border: "rgba(250,204,21,0.45)", glow: "rgba(234,179,8,0.08)", text: "#fef08a"},
    narration: {border: "rgba(168,85,247,0.46)", glow: "rgba(147,51,234,0.09)", text: "#e9d5ff"},
    handwriting: {border: "rgba(244,114,182,0.45)", glow: "rgba(219,39,119,0.08)", text: "#fbcfe8"},
    interactive_bundle: {border: "rgba(132,204,22,0.48)", glow: "rgba(101,163,13,0.08)", text: "#d9f99d"},
    lesson_publish: {border: "rgba(52,211,153,0.56)", glow: "rgba(16,185,129,0.12)", text: "#bbf7d0"}
  };
  return palettes[stage];
}

export function statusColor(status?: string) {
  if (status === "completed" || status === "approved") {
    return "#a7f3d0";
  }
  if (status === "failed" || status === "rejected") {
    return "#fecaca";
  }
  if (status === "stale") {
    return "#fde68a";
  }
  if (status === "running") {
    return "#bae6fd";
  }
  if (status === "awaiting_approval") {
    return "#ddd6fe";
  }
  return "#d4d4d8";
}

export function artifactPreviewRows(artifact: GameLessonArtifact | null, stage: GameLessonStage): Array<{label: string; value: string}> {
  if (!artifact) {
    return [];
  }
  const payload = artifactPayloadRecord(artifact);
  if (stage === "template") {
    return [
      {label: "sections", value: String(countPayloadArray(payload, "sections"))},
      {label: "questions", value: String(countPayloadArray(payload, "questions"))},
      {label: "fill targets", value: String(countPayloadArray(payload, "fillTargets"))}
    ];
  }
  if (stage === "section_script") {
    return [
      {label: "sections", value: String(countPayloadArray(payload, "sections"))},
      {label: "approval", value: artifact.status === "approved" ? "approved" : artifact.status === "awaiting_approval" ? "required" : "not ready"}
    ];
  }
  if (stage === "speech_markup") {
    return [
      {label: "markup blocks", value: String(countPayloadArray(payload, "sections"))},
      {label: "approval", value: artifact.status === "approved" ? "approved" : artifact.status === "awaiting_approval" ? "required" : "not ready"}
    ];
  }
  if (stage === "narration") {
    const segmentCount = countPayloadArray(payload, "sections") || countPayloadArray(payload, "segments");
    return [
      {label: "segments", value: String(segmentCount)},
      {label: "provider", value: typeof payload.provider === "string" ? payload.provider : "preview"}
    ];
  }
  if (stage === "handwriting") {
    return [
      {label: "actions", value: String(countPayloadArray(payload, "actions"))},
      {label: "renderer", value: "browser pen"}
    ];
  }
  if (stage === "lesson_publish") {
    return [
      {label: "published", value: payload.published === true ? "yes" : "no"},
      {label: "sections", value: typeof payload.sectionCount === "number" ? String(payload.sectionCount) : "0"},
      {label: "pages", value: typeof payload.pageCount === "number" ? String(payload.pageCount) : "0"}
    ];
  }
  return [
    {label: "pages", value: String(countPayloadArray(payload, "pages"))},
    {label: "sections", value: String(countPayloadArray(payload, "sections"))}
  ];
}

export function artifactPreviewText(artifact: GameLessonArtifact | null, stage: GameLessonStage) {
  if (!artifact) {
    return "";
  }
  const payload = artifactPayloadRecord(artifact);
  const sections = Array.isArray(payload.sections) ? payload.sections : [];
  if ((stage === "section_script" || stage === "speech_markup") && sections.length > 0) {
    const firstSection = sections[0];
    if (firstSection && typeof firstSection === "object") {
      const record = firstSection as Record<string, unknown>;
      const text = typeof record.narration === "string" ? record.narration : typeof record.speechText === "string" ? record.speechText : "";
      return text.length > 180 ? `${text.slice(0, 180)}...` : text;
    }
  }
  if (stage === "handwriting") {
    const actions = Array.isArray(payload.actions) ? payload.actions : [];
    const firstAction = actions.find((action) => action && typeof action === "object") as Record<string, unknown> | undefined;
    const text = typeof firstAction?.text === "string" ? firstAction.text : "";
    return text ? `First write action: ${text}` : "";
  }
  if (stage === "interactive_bundle") {
    return "Playable browser bundle for click-through worksheet playback.";
  }
  if (stage === "lesson_publish") {
    return "Marks the approved interactive bundle as the canonical Lesson 1 output.";
  }
  return artifact.summary ?? "";
}

export type GameStageDetails = {
  summary: string;
  inputs: string;
  guardrails: string;
  cost: string;
  prompt?: string;
};

export const gameStageDetails: Record<GameLessonStage, GameStageDetails> = {
  template: {
    summary: "Builds the deterministic map for Lesson 1 before any model writes content.",
    inputs: "The fixed Volume With Cubes worksheet template, manually defined page regions, questions, fill targets, and section order.",
    guardrails: "The template is deterministic and should be reviewed carefully because downstream LLM stages can only write into these known targets.",
    cost: "Free. Local template mapping only."
  },
  section_script: {
    summary: "Writes the section-level teaching script for the worksheet.",
    inputs: "Template sections, questions, fill targets, grade level, and the lesson voice constraints.",
    guardrails: "The model must stay inside the worksheet map, explain at a sixth-grade level, and produce concise section scripts for human approval.",
    cost: "OpenAI token usage is logged for the game lesson ledger.",
    prompt: "Provider path: apps/api/app/services/game_lessons/providers.py"
  },
  speech_markup: {
    summary: "Turns the approved section script into ElevenLabs-friendly narration text.",
    inputs: "Approved section scripts and their section IDs.",
    guardrails: "Speech markup preserves section IDs and only changes wording, pauses, and speaking flow for reliable narration.",
    cost: "OpenAI token usage is logged if the configured markup provider uses an LLM.",
    prompt: "Provider path: apps/api/app/services/game_lessons/providers.py"
  },
  narration: {
    summary: "Generates one ElevenLabs audio segment per major worksheet section.",
    inputs: "Approved speech markup, selected instructor voice ID, and ElevenLabs model configuration.",
    guardrails: "Each audio segment is stored privately, signed for playback, and tied to the section ID for later interactive playback.",
    cost: "ElevenLabs credit usage is logged from generated speech character count."
  },
  handwriting: {
    summary: "Creates the timed pen-writing action plan for the worksheet.",
    inputs: "Template fill targets plus generated section narration timing.",
    guardrails: "Actions must reference known section and fill-target IDs so the browser pen can write only into mapped worksheet regions.",
    cost: "Free in the current implementation. Browser-side renderer actions are deterministic."
  },
  interactive_bundle: {
    summary: "Packages the worksheet pages, narration, and pen actions into a clickable browser lesson.",
    inputs: "Template, approved script, narration audio, and handwriting actions.",
    guardrails: "The bundle is the playback contract used by the desk paper and should remain stable until an upstream artifact is rerun.",
    cost: "Free. Bundle assembly only."
  },
  lesson_publish: {
    summary: "Marks the current interactive bundle as the canonical Lesson 1 output.",
    inputs: "Completed interactive bundle artifact.",
    guardrails: "Publishing does not regenerate content. It only records which bundle the paper should use as Lesson 1.",
    cost: "Free. Metadata update only."
  }
};

export function artifactSections(artifact: GameLessonArtifact | null): Array<Record<string, unknown>> {
  const payload = artifactPayloadRecord(artifact);
  return Array.isArray(payload.sections) ? payload.sections.filter(isRecord) : [];
}

export function artifactActions(artifact: GameLessonArtifact | null): Array<Record<string, unknown>> {
  const payload = artifactPayloadRecord(artifact);
  return Array.isArray(payload.actions) ? payload.actions.filter(isRecord) : [];
}

export function recordString(record: Record<string, unknown>, key: string) {
  return typeof record[key] === "string" ? record[key] : undefined;
}

export function recordNumber(record: Record<string, unknown>, key: string) {
  return typeof record[key] === "number" ? record[key] : undefined;
}

function formatPipelineTimestamp(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit"
  }).format(date);
}

function artifactPayloadRecord(artifact: GameLessonArtifact | null): Record<string, unknown> {
  return artifact && artifact.payload && typeof artifact.payload === "object" && !Array.isArray(artifact.payload)
    ? artifact.payload as Record<string, unknown>
    : {};
}

function countPayloadArray(payload: Record<string, unknown>, key: string) {
  return Array.isArray(payload[key]) ? payload[key].length : 0;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}
