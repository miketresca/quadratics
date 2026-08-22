import {useEffect, useRef, useState} from "react";

import type {GameLessonArtifact, GameLessonStage, GameWorksheetRunSnapshot} from "@/lib/api";

import {
  GAME_LESSON_DEFAULT_INSTRUCTOR_LABEL,
  GAME_LESSON_STAGES,
  artifactActions,
  artifactForStage,
  artifactPreviewRows,
  artifactPreviewText,
  artifactSections,
  gameStageDetails,
  gameStageMetaLine,
  pipelineDependencyMessage,
  recordNumber,
  recordString,
  shortRunId,
  stagePalette,
  statusTextClass
} from "./game-pipeline-utils";

type LaptopPipelineState = {
  error: string | null;
  loading: boolean;
  loadingStage: GameLessonStage | null;
  run: GameWorksheetRunSnapshot | null;
};

export function FocusedPipelinePanel({
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
  onSaveArtifact: (artifact: GameLessonArtifact, payload: Record<string, unknown>) => Promise<void> | void;
  pipeline: LaptopPipelineState;
}) {
  return (
    <div
      className="grid h-full min-h-0 content-start gap-4 overflow-y-auto overscroll-contain rounded-2xl border border-emerald-200/15 bg-[#050b10] p-6"
      onWheel={(event) => event.stopPropagation()}
    >
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-[11px] uppercase tracking-[0.28em] text-emerald-200/65">worksheet pipeline</p>
          <h2 className="mt-3 text-2xl font-black text-zinc-50">{pipeline.run ? pipeline.run.templateTitle : "Lesson run not started"}</h2>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-zinc-400">
            {pipeline.run
              ? `Run ${shortRunId(pipeline.run.id)} is ready for the approval-gated worksheet pipeline.`
              : "Click Lesson 1 on the paper to create the signed-in worksheet run. Script, speech markup, narration, and handwriting artifacts will appear here."}
          </p>
          <p className="mt-3 w-fit rounded border border-emerald-300/20 bg-emerald-950/20 px-3 py-1.5 font-mono text-[11px] uppercase tracking-wider text-emerald-100/80">
            Voice / {GAME_LESSON_DEFAULT_INSTRUCTOR_LABEL}
          </p>
          <a
            className="mt-3 inline-flex w-fit rounded border border-cyan-300/30 bg-cyan-950/20 px-3 py-1.5 text-[11px] font-black uppercase tracking-widest text-cyan-100 hover:bg-cyan-900/35"
            href="/game/lessons/volume-cubes/task-lesson.pdf"
            rel="noreferrer"
            target="_blank"
          >
            Open template PDF
          </a>
        </div>
        <div className="flex flex-col gap-2">
          <button
            className="rounded-lg border border-emerald-300/55 bg-emerald-950/45 px-4 py-2 text-xs font-black uppercase tracking-widest text-emerald-100 hover:bg-emerald-900/50 disabled:cursor-wait disabled:opacity-60"
            disabled={pipeline.loading}
            onClick={onCreateRun}
            type="button"
          >
            {pipeline.loading ? "Starting" : pipeline.run ? "Refresh template" : "Create run"}
          </button>
          <button
            className="rounded-lg border border-amber-300/35 bg-amber-950/20 px-4 py-2 text-xs font-black uppercase tracking-widest text-amber-100 hover:bg-amber-900/30 disabled:cursor-wait disabled:opacity-60"
            disabled={pipeline.loading}
            onClick={onResetProgress}
            type="button"
          >
            Reset progress
          </button>
        </div>
      </div>
      {pipeline.error ? (
        <div className="rounded-lg border border-red-400/40 bg-red-950/35 px-3 py-2 text-sm text-red-100">{pipeline.error}</div>
      ) : null}
      <GameLessonPipelineSelector />
      <div className="grid gap-3">
        {GAME_LESSON_STAGES.map(({label, stage}) => {
          const artifact = artifactForStage(pipeline.run, stage);
          const dependencyMessage = pipelineDependencyMessage(pipeline.run, stage);
          const canRun = !pipeline.loading && !dependencyMessage;
          return (
            <GamePipelineStageCard
              artifact={artifact}
              canRun={canRun}
              dependencyMessage={dependencyMessage}
              isRunning={pipeline.loadingStage === stage || artifact?.status === "running"}
              key={stage}
              label={label}
              loading={pipeline.loading}
              onApproveArtifact={onApproveArtifact}
              onRunStage={onRunStage}
              onSaveArtifact={onSaveArtifact}
              stage={stage}
            />
          );
        })}
      </div>
    </div>
  );
}

function GamePipelineStageCard({
  artifact,
  canRun,
  dependencyMessage,
  isRunning,
  label,
  loading,
  onApproveArtifact,
  onRunStage,
  onSaveArtifact,
  stage
}: {
  artifact: GameLessonArtifact | null;
  canRun: boolean;
  dependencyMessage: string | null;
  isRunning: boolean;
  label: string;
  loading: boolean;
  onApproveArtifact: (artifact: GameLessonArtifact) => void;
  onRunStage: (stage: GameLessonStage, options?: {force?: boolean}) => void;
  onSaveArtifact: (artifact: GameLessonArtifact, payload: Record<string, unknown>) => Promise<void> | void;
  stage: GameLessonStage;
}) {
  const palette = stagePalette(stage);
  const status = artifact?.status ?? (stage === "template" ? "ready" : "waiting");
  const isFailed = status === "failed" || status === "rejected";
  const isStale = status === "stale";
  const actionLabel = artifact ? `Regenerate ${label}` : `Run ${label}`;
  return (
    <div
      className="rounded border bg-zinc-950/50 p-4 shadow-[inset_0_0_40px_rgba(255,255,255,0.015)]"
      style={{borderColor: palette.border, boxShadow: `inset 0 0 54px ${palette.glow}`}}
    >
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="flex min-w-0 items-center gap-2">
            <GamePipelineStageInfo stage={stage} title={label} />
            <p className="font-mono text-sm font-black uppercase tracking-wide" style={{color: palette.text}}>
              {label}
            </p>
          </div>
          <p className={`mt-2 font-mono text-[11px] uppercase tracking-wide ${statusTextClass(status)}`}>
            {gameStageMetaLine(artifact, status)}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {isStale ? <GamePipelineStageBadge tone="amber">STALE</GamePipelineStageBadge> : null}
          {isFailed ? <GamePipelineStageBadge tone="red">FAILED</GamePipelineStageBadge> : null}
          {isRunning ? <GamePipelineSpinner /> : null}
          <button
            aria-label={actionLabel}
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded border border-zinc-700 text-zinc-300 transition hover:border-emerald-400/60 hover:bg-emerald-400/10 hover:text-emerald-200 disabled:cursor-not-allowed disabled:opacity-40"
            disabled={!canRun || isRunning}
            onClick={() => onRunStage(stage, {force: Boolean(artifact)})}
            title={actionLabel}
            type="button"
          >
            {artifact ? <GamePipelineRegenerateIcon /> : <GamePipelineRunIcon />}
          </button>
          {artifact?.status === "awaiting_approval" ? (
            <button
              className="rounded border border-emerald-300/45 bg-emerald-950/25 px-3 py-1.5 text-[11px] font-black uppercase tracking-wider text-emerald-100 hover:bg-emerald-900/35 disabled:cursor-wait disabled:opacity-50"
              disabled={loading || isRunning}
              onClick={() => onApproveArtifact(artifact)}
              type="button"
            >
              Approve
            </button>
          ) : null}
        </div>
      </div>
      {dependencyMessage ? <p className="mt-3 text-xs leading-5 text-amber-100/70">{dependencyMessage}</p> : null}
      {artifact?.staleReason ? <p className="mt-3 text-xs leading-5 text-amber-100/70">Stale: {artifact.staleReason}</p> : null}
      {artifact?.errorMessage ? <p className="mt-3 text-xs leading-5 text-red-100/80">{artifact.errorMessage}</p> : null}
      <GamePipelineStagePreview artifact={artifact} onSaveArtifact={onSaveArtifact} stage={stage} />
      <GamePipelineStageIo artifact={artifact} />
    </div>
  );
}

function GameLessonPipelineSelector() {
  return (
    <div className="grid gap-2 rounded-xl border border-white/10 bg-black/20 p-2 sm:grid-cols-3">
      {[
        {label: "Lesson 1", status: "active", title: "Volume With Cubes"},
        {label: "Lesson 2", status: "locked", title: "Generated Worksheet"},
        {label: "Lesson 3", status: "locked", title: "Future Challenge"}
      ].map((lesson) => (
        <button
          className={[
            "rounded-lg border px-3 py-2 text-left transition",
            lesson.status === "active"
              ? "border-emerald-300/55 bg-emerald-950/35 text-emerald-100"
              : "cursor-not-allowed border-zinc-800 bg-zinc-950/40 text-zinc-500"
          ].join(" ")}
          disabled={lesson.status !== "active"}
          key={lesson.label}
          type="button"
        >
          <span className="block font-mono text-[10px] uppercase tracking-widest">{lesson.label}</span>
          <span className="mt-1 block truncate text-sm font-black">{lesson.title}</span>
          <span className="mt-1 block font-mono text-[10px] uppercase tracking-wider opacity-70">{lesson.status}</span>
        </button>
      ))}
    </div>
  );
}

function GamePipelineStageIo({artifact}: {artifact: GameLessonArtifact | null}) {
  const stageInput = artifact?.configMetadata.stageInput;
  const stageOutput = artifact?.configMetadata.stageOutput ?? artifact?.payload;
  if (!artifact || (typeof stageInput === "undefined" && typeof stageOutput === "undefined")) {
    return null;
  }
  return (
    <details className="mt-4 rounded border border-white/10 bg-black/20">
      <summary className="cursor-pointer px-3 py-2 font-mono text-[10px] uppercase tracking-wide text-zinc-400 hover:text-emerald-200">
        Input / Output
      </summary>
      <div className="grid gap-3 border-t border-white/10 p-3 lg:grid-cols-2">
        <GamePipelineJsonPanel label="Input" value={stageInput ?? null} />
        <GamePipelineJsonPanel label="Output" value={stageOutput ?? null} />
      </div>
    </details>
  );
}

function GamePipelineJsonPanel({label, value}: {label: string; value: unknown}) {
  return (
    <div className="min-w-0 rounded border border-white/10 bg-zinc-950/70 p-3">
      <p className="font-mono text-[10px] uppercase tracking-wide text-zinc-500">{label}</p>
      <pre className="mt-2 max-h-72 overflow-auto whitespace-pre-wrap break-words font-mono text-[11px] leading-5 text-zinc-300">
        {JSON.stringify(value, null, 2)}
      </pre>
    </div>
  );
}

function GamePipelineStageInfo({stage, title}: {stage: GameLessonStage; title: string}) {
  const triggerRef = useRef<HTMLSpanElement>(null);
  const [position, setPosition] = useState<{left: number; top: number; width: number} | null>(null);
  const details = gameStageDetails[stage];
  const open = position !== null;

  function openPanel() {
    const rect = triggerRef.current?.getBoundingClientRect();
    if (!rect) {
      return;
    }
    const width = Math.min(380, window.innerWidth - 24);
    const left = Math.max(12, Math.min(rect.left - width - 18, window.innerWidth - width - 12));
    const maxPanelHeight = Math.min(440, window.innerHeight - 24);
    const top = Math.max(12, Math.min(rect.top - 12, window.innerHeight - maxPanelHeight - 12));
    setPosition({left, top, width});
  }

  return (
    <span
      className="relative inline-flex h-5 w-5 shrink-0 items-center justify-center"
      onBlur={() => setPosition(null)}
      onFocus={openPanel}
      onMouseEnter={openPanel}
      onMouseLeave={() => setPosition(null)}
    >
      <span
        aria-label={`${title} info`}
        className={[
          "flex h-4 w-4 items-center justify-center rounded-full border font-mono text-[10px] font-semibold transition",
          open ? "border-emerald-400/60 text-emerald-300" : "border-zinc-700 text-zinc-500"
        ].join(" ")}
        ref={triggerRef}
        tabIndex={0}
      >
        i
      </span>
      {position ? (
        <span
          className="pointer-events-none fixed z-[420] max-h-[min(440px,calc(100vh-24px))] overflow-auto rounded border border-zinc-700 bg-[#090d14]/98 p-3 text-left text-xs leading-5 text-zinc-200 shadow-2xl shadow-black/70 backdrop-blur"
          style={{left: position.left, top: position.top, width: position.width}}
        >
          <span className="block break-words font-mono text-[11px] uppercase tracking-wide text-emerald-300">{title}</span>
          <span className="mt-2 block break-words text-zinc-200">{details.summary}</span>
          <span className="mt-3 grid gap-2">
            <GamePipelineInfoRow label="Inputs" value={details.inputs} />
            <GamePipelineInfoRow label="Guardrails" value={details.guardrails} />
            <GamePipelineInfoRow label="Cost" value={details.cost} />
            {details.prompt ? <GamePipelineInfoRow label="Prompt" value={details.prompt} /> : null}
          </span>
        </span>
      ) : null}
    </span>
  );
}

function GamePipelineInfoRow({label, value}: {label: string; value: string}) {
  return (
    <span className="grid gap-0.5 border-t border-zinc-800 pt-2">
      <span className="font-mono text-[10px] uppercase tracking-wide text-zinc-500">{label}</span>
      <span className="break-words text-zinc-300">{value}</span>
    </span>
  );
}

function GamePipelineStagePreview({
  artifact,
  onSaveArtifact,
  stage
}: {
  artifact: GameLessonArtifact | null;
  onSaveArtifact: (artifact: GameLessonArtifact, payload: Record<string, unknown>) => Promise<void> | void;
  stage: GameLessonStage;
}) {
  const previewRows = artifactPreviewRows(artifact, stage);
  const previewText = artifactPreviewText(artifact, stage);
  const sections = artifactSections(artifact);
  const actions = artifactActions(artifact);
  if (!artifact) {
    return <p className="mt-3 text-xs leading-5 text-zinc-500">Run this stage to create a persisted artifact preview.</p>;
  }
  if (stage === "section_script" || stage === "speech_markup") {
    return (
      <div className="mt-4 grid gap-3">
        <GamePipelinePreviewRows rows={previewRows} stage={stage} />
        <EditableScriptPreview
          artifact={artifact}
          onSaveArtifact={onSaveArtifact}
          sections={sections}
          stage={stage}
        />
      </div>
    );
  }
  if (stage === "narration") {
    return (
      <div className="mt-4 grid gap-3">
        <GamePipelinePreviewRows rows={previewRows} stage={stage} />
        {sections.map((section, index) => (
          <div className="rounded border border-white/10 bg-black/25 p-3" key={`narration-${recordString(section, "sectionId") ?? index}`}>
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="font-mono text-[10px] uppercase tracking-wide text-zinc-500">
                  {recordString(section, "sectionId") ?? `segment_${index + 1}`}
                </p>
                <p className="mt-1 text-sm font-semibold text-zinc-100">
                  {recordString(section, "title") ?? `Narration segment ${index + 1}`}
                </p>
              </div>
              {typeof recordNumber(section, "durationSeconds") === "number" ? (
                <span className="font-mono text-[11px] text-violet-200">{recordNumber(section, "durationSeconds")?.toFixed(1)}s</span>
              ) : null}
            </div>
            {recordString(section, "audioUrl") ? (
              <audio className="mt-3 h-9 w-full" controls preload="none" src={recordString(section, "audioUrl")} />
            ) : null}
            {recordString(section, "speechText") ? <p className="mt-2 text-xs leading-5 text-zinc-400">{recordString(section, "speechText")}</p> : null}
          </div>
        ))}
      </div>
    );
  }
  if (stage === "handwriting") {
    return (
      <div className="mt-4 grid gap-3">
        <GamePipelinePreviewRows rows={previewRows} stage={stage} />
        {actions.slice(0, 6).map((action, index) => (
          <div className="grid gap-1 rounded border border-white/10 bg-black/25 p-3" key={`handwriting-${recordString(action, "id") ?? index}`}>
            <p className="font-mono text-[10px] uppercase tracking-wide text-pink-200/75">
              {recordString(action, "sectionId") ?? "section"} / {recordString(action, "fillTargetId") ?? "target"}
            </p>
            <p className="text-xs leading-5 text-zinc-300">{recordString(action, "text") ?? "Pen action"}</p>
          </div>
        ))}
      </div>
    );
  }
  return (
    <div className="mt-4">
      <GamePipelinePreviewRows rows={previewRows} stage={stage} />
      {previewText ? <p className="mt-3 text-xs leading-5 text-zinc-400">{previewText}</p> : null}
    </div>
  );
}

function EditableScriptPreview({
  artifact,
  onSaveArtifact,
  sections,
  stage
}: {
  artifact: GameLessonArtifact;
  onSaveArtifact: (artifact: GameLessonArtifact, payload: Record<string, unknown>) => Promise<void> | void;
  sections: Array<Record<string, unknown>>;
  stage: GameLessonStage;
}) {
  const textKey = stage === "speech_markup" ? "speechText" : "narration";
  const sectionsKey = sections.map((section) => `${recordString(section, "sectionId") ?? ""}:${recordString(section, textKey) ?? ""}`).join("|");
  const [drafts, setDrafts] = useState<string[]>(() => sections.map((section) => recordString(section, textKey) ?? ""));
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setDrafts(sections.map((section) => recordString(section, textKey) ?? ""));
    setError(null);
    setSaving(false);
  }, [artifact.id, artifact.version, sectionsKey, textKey]);

  const dirty = sections.some((section, index) => drafts[index] !== (recordString(section, textKey) ?? ""));

  function resetDrafts() {
    setDrafts(sections.map((section) => recordString(section, textKey) ?? ""));
    setError(null);
  }

  async function saveDrafts() {
    setSaving(true);
    setError(null);
    try {
      const nextSections = sections.map((section, index) => ({
        ...section,
        [textKey]: drafts[index] ?? ""
      }));
      await onSaveArtifact(artifact, {
        ...artifact.payload,
        sections: nextSections
      });
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Could not save this stage.");
    } finally {
      setSaving(false);
    }
  }

  if (sections.length === 0) {
    return <p className="rounded border border-amber-300/25 bg-amber-950/20 p-3 text-xs text-amber-100/75">No editable sections were produced for this stage.</p>;
  }

  return (
    <div className="grid gap-3">
      {sections.slice(0, 4).map((section, index) => (
        <label className="grid gap-2 rounded border border-white/10 bg-black/25 p-3" key={`${stage}-${recordString(section, "sectionId") ?? index}`}>
          <span className="flex items-start justify-between gap-3">
            <span className="text-sm font-bold text-zinc-100">
              {recordString(section, "title") ?? recordString(section, "sectionId") ?? `Section ${index + 1}`}
            </span>
            {typeof recordNumber(section, "estimatedSeconds") === "number" ? (
              <span className="font-mono text-[11px] text-zinc-500">{recordNumber(section, "estimatedSeconds")}s</span>
            ) : null}
          </span>
          <textarea
            className="min-h-24 resize-y rounded border border-zinc-800 bg-zinc-950/70 px-3 py-2 font-mono text-xs leading-5 text-zinc-200 outline-none transition focus:border-emerald-300/60"
            onChange={(event) => {
              const nextDrafts = [...drafts];
              nextDrafts[index] = event.target.value;
              setDrafts(nextDrafts);
            }}
            value={drafts[index] ?? ""}
          />
        </label>
      ))}
      {error ? <p className="rounded border border-red-400/35 bg-red-950/30 px-3 py-2 text-xs text-red-100">{error}</p> : null}
      {dirty ? (
        <div className="flex flex-wrap justify-end gap-2">
          <button
            className="rounded border border-zinc-700 px-3 py-1.5 text-[11px] font-black uppercase tracking-widest text-zinc-300 hover:bg-zinc-900 disabled:cursor-wait disabled:opacity-60"
            disabled={saving}
            onClick={resetDrafts}
            type="button"
          >
            Cancel
          </button>
          <button
            className="rounded border border-emerald-300/50 bg-emerald-950/30 px-3 py-1.5 text-[11px] font-black uppercase tracking-widest text-emerald-100 hover:bg-emerald-900/40 disabled:cursor-wait disabled:opacity-60"
            disabled={saving}
            onClick={() => {
              void saveDrafts();
            }}
            type="button"
          >
            {saving ? "Saving" : "Save edits"}
          </button>
        </div>
      ) : null}
    </div>
  );
}

function GamePipelinePreviewRows({rows, stage}: {rows: Array<{label: string; value: string}>; stage: GameLessonStage}) {
  if (rows.length === 0) {
    return null;
  }
  return (
    <div className="grid grid-cols-1 gap-2 md:grid-cols-3">
      {rows.map((row) => (
        <div className="rounded border border-white/10 bg-black/25 px-3 py-2" key={`${stage}-${row.label}`}>
          <p className="font-mono text-[10px] uppercase tracking-wide text-zinc-500">{row.label}</p>
          <p className="mt-1 text-sm font-semibold text-zinc-100">{row.value}</p>
        </div>
      ))}
    </div>
  );
}

function GamePipelineStageBadge({children, tone}: {children: string; tone: "amber" | "red"}) {
  const className = tone === "amber" ? "border-amber-400/40 text-amber-200" : "border-red-400/50 text-red-200";
  return <span className={`rounded border px-2 py-1 font-mono text-[10px] font-semibold ${className}`}>{children}</span>;
}

function GamePipelineSpinner() {
  return (
    <svg
      aria-label="Loading"
      className="h-4 w-4 animate-spin text-emerald-300"
      fill="none"
      role="status"
      viewBox="0 0 24 24"
    >
      <circle className="opacity-25" cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="3" />
      <path className="opacity-90" d="M21 12a9 9 0 0 0-9-9" stroke="currentColor" strokeLinecap="round" strokeWidth="3" />
    </svg>
  );
}

function GamePipelineRegenerateIcon() {
  return (
    <svg aria-hidden="true" className="h-4 w-4" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" viewBox="0 0 24 24">
      <path d="M21 12a9 9 0 1 1-2.6-6.4" />
      <path d="M21 3v6h-6" />
      <path d="m10 8 6 4-6 4V8z" />
    </svg>
  );
}

function GamePipelineRunIcon() {
  return (
    <svg aria-hidden="true" className="h-4 w-4" fill="currentColor" viewBox="0 0 24 24">
      <path d="M8 5v14l11-7z" />
    </svg>
  );
}
