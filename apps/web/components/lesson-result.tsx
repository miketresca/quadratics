"use client";

import type {
  AnimationPlan,
  GenerationArtifact,
  GenerationSnapshot,
  Lesson,
  LessonNarration,
  LessonScript,
  NarrationSegment,
  ResolvedAnimationTimeline
} from "@quadratics/types";
import {useState} from "react";

import {flattenLessonMathLines} from "@/lib/lesson-view";

type StageRunOptions = {force?: boolean};

export function LessonResult({
  actionDisabled = false,
  generation,
  lesson,
  loadingStage,
  narration,
  narrationLoading = false,
  onGenerateNarration,
  onGenerateScript,
  onRunStage,
  speechMarkupLoading = false,
  script,
  scriptLoading = false
}: {
  actionDisabled?: boolean;
  generation?: GenerationSnapshot;
  lesson: Lesson | null;
  loadingStage?: string;
  narration?: LessonNarration;
  narrationLoading?: boolean;
  onGenerateNarration?: () => void;
  onGenerateScript?: () => void;
  onRunStage?: (stage: string, options?: StageRunOptions) => void;
  speechMarkupLoading?: boolean;
  script?: LessonScript;
  scriptLoading?: boolean;
}) {
  const [activeView, setActiveView] = useState<"lesson" | "logs">("logs");
  const solutionLines = lesson ? flattenLessonMathLines(lesson) : [];
  const effectiveScript = script ?? payloadForStage<LessonScript>(generation, "teacher_script");
  const effectiveNarration = narration ?? payloadForStage<LessonNarration>(generation, "elevenlabs_audio");
  const speechMarkup = effectiveNarration ?? payloadForStage<LessonNarration>(generation, "elevenlabs_request");
  const animationPlan = payloadForStage<AnimationPlan>(generation, "animation_plan");
  const resolvedTimeline = payloadForStage<ResolvedAnimationTimeline>(generation, "resolved_timeline");
  const baseVideo = artifactForStage(generation, "base_video");

  return (
    <section className="mx-auto mt-6 max-w-3xl" aria-live="polite">
      <div className="mb-4 flex flex-col items-center justify-center gap-3 sm:flex-row">
        <div className="grid w-64 grid-cols-2 rounded-full border border-zinc-800 bg-zinc-950/70 p-1 text-sm shadow-xl shadow-black/30">
          <button className={viewButtonClass(activeView === "lesson")} onClick={() => setActiveView("lesson")} type="button">
            Lesson
          </button>
          <button className={viewButtonClass(activeView === "logs")} onClick={() => setActiveView("logs")} type="button">
            Logs
          </button>
        </div>
      </div>

      {activeView === "lesson" ? (
        <LessonPreview artifact={baseVideo} loading={loadingStage === "motion_canvas_render"} />
      ) : (
        <>
          {lesson ? <AnswerLog lesson={lesson} /> : <PendingLog title="answer" />}

          {solutionLines.length > 0 ? <SolutionLinesLog lines={solutionLines} /> : lesson ? null : <PendingLog className="mt-6" title="solution_lines" />}

          {effectiveScript ? (
            <ScriptLog artifact={artifactForStage(generation, "teacher_script")} script={effectiveScript} />
          ) : scriptLoading ? (
            <PendingLog accent="sky" className="mt-6" title="teacher_script" />
          ) : lesson ? (
            <RunnableLog accent="sky" className="mt-6" disabled={actionDisabled || !onGenerateScript} onRun={onGenerateScript} title="teacher_script" />
          ) : null}

          {speechMarkup?.speechText ? (
            <SpeechMarkupLog artifact={artifactForStage(generation, "elevenlabs_request")} narration={speechMarkup} />
          ) : speechMarkupLoading ? (
            <PendingLog accent="amber" className="mt-6" title="elevenlabs_request" />
          ) : effectiveScript?.status === "completed" ? (
            <RunnableLog accent="amber" className="mt-6" disabled={actionDisabled || !onGenerateNarration} onRun={onGenerateNarration} title="elevenlabs_request" />
          ) : null}

          {effectiveNarration ? (
            <NarrationLog
              artifact={artifactForStage(generation, "elevenlabs_audio")}
              narration={effectiveNarration}
            />
          ) : narrationLoading ? (
            <PendingLog accent="fuchsia" className="mt-6" title="elevenlabs_audio" />
          ) : null}

          {animationPlan ? (
            <AnimationPlanLog
              actionDisabled={actionDisabled}
              artifact={artifactForStage(generation, "animation_plan")}
              loading={loadingStage === "animation_plan"}
              onRun={onRunStage ? () => onRunStage("animation_plan", {force: true}) : undefined}
              plan={animationPlan}
              timeline={resolvedTimeline}
            />
          ) : loadingStage === "animation_plan" ? (
            <PendingLog accent="violet" className="mt-6" title="animation_plan" />
          ) : effectiveNarration?.status === "completed" ? (
            <RunnableLog
              accent="violet"
              className="mt-6"
              disabled={actionDisabled || !onRunStage}
              onRun={onRunStage ? () => onRunStage("animation_plan") : undefined}
              title="animation_plan"
            />
          ) : null}

          {resolvedTimeline ? (
            <TimelineLog
              actionDisabled={actionDisabled}
              artifact={artifactForStage(generation, "resolved_timeline")}
              loading={loadingStage === "resolved_timeline"}
              onRun={onRunStage ? () => onRunStage("resolved_timeline", {force: true}) : undefined}
              timeline={resolvedTimeline}
            />
          ) : loadingStage === "resolved_timeline" ? (
            <PendingLog accent="cyan" className="mt-6" title="resolved_timeline" />
          ) : animationPlan ? (
            <RunnableLog
              accent="cyan"
              className="mt-6"
              disabled={actionDisabled || !onRunStage}
              onRun={onRunStage ? () => onRunStage("resolved_timeline") : undefined}
              title="resolved_timeline"
            />
          ) : null}

          {baseVideo ? (
            <RenderLog
              actionDisabled={actionDisabled}
              artifact={baseVideo}
              loading={loadingStage === "motion_canvas_render"}
              onRun={onRunStage ? () => onRunStage("motion_canvas_render", {force: true}) : undefined}
            />
          ) : loadingStage === "motion_canvas_render" ? (
            <PendingLog accent="lime" className="mt-6" title="motion_canvas_render" />
          ) : resolvedTimeline ? (
            <RunnableLog
              accent="lime"
              className="mt-6"
              disabled={actionDisabled || !onRunStage}
              onRun={onRunStage ? () => onRunStage("motion_canvas_render") : undefined}
              title="motion_canvas_render"
            />
          ) : null}
        </>
      )}
    </section>
  );
}

function LessonPreview({artifact, loading}: {artifact?: GenerationArtifact; loading?: boolean}) {
  const storageObject = artifact?.storageObjects?.[0];
  return (
    <div className="min-h-64 rounded border border-zinc-800 bg-zinc-950/25 p-4" aria-label="Lesson preview">
      {loading ? (
        <div className="flex min-h-56 items-center justify-center gap-3 text-sm text-zinc-300">
          <Spinner />
          rendering lesson video
        </div>
      ) : artifact?.status === "completed" ? (
        <div className="grid min-h-56 content-center gap-3">
          <p className="font-mono text-sm uppercase tracking-wide text-lime-300">base video ready</p>
          <p className="text-sm text-zinc-300">The render artifact is complete. Playback URLs will be served from private storage.</p>
          {storageObject ? <ArtifactStorage object={storageObject} /> : null}
        </div>
      ) : (
        <div className="flex min-h-56 items-center justify-center text-sm text-zinc-500">No rendered lesson video yet.</div>
      )}
    </div>
  );
}

function AnswerLog({lesson}: {lesson: Lesson}) {
  return (
    <div className="rounded border border-zinc-700/80 bg-zinc-950/55 p-4 backdrop-blur">
      <h2 className="font-mono text-lg text-zinc-100">answer</h2>
      <dl className="mt-4 grid gap-3 text-sm text-zinc-300 sm:grid-cols-2">
        <div>
          <dt className="text-xs uppercase tracking-wide text-zinc-500">Normalized equation</dt>
          <dd className="font-mono text-zinc-100">{lesson.normalizedEquation}</dd>
        </div>
        <div>
          <dt className="text-xs uppercase tracking-wide text-zinc-500">Method</dt>
          <dd>{lesson.method ?? "Unsupported for v0 lessons"}</dd>
        </div>
        <div>
          <dt className="text-xs uppercase tracking-wide text-zinc-500">Coefficients</dt>
          <dd>
            a={lesson.coefficients.a.expression}, b={lesson.coefficients.b.expression}, c={lesson.coefficients.c.expression}
          </dd>
        </div>
        <div>
          <dt className="text-xs uppercase tracking-wide text-zinc-500">Roots</dt>
          <dd className="font-mono text-emerald-300">{lesson.solutions.map((solution) => solution.expression).join(", ")}</dd>
        </div>
      </dl>
      {lesson.unsupportedReason ? (
        <p className="mt-4 rounded border border-amber-500/50 bg-amber-950/40 p-3 text-sm text-amber-100">{lesson.unsupportedReason}</p>
      ) : null}
    </div>
  );
}

function SolutionLinesLog({lines}: {lines: ReturnType<typeof flattenLessonMathLines>}) {
  return (
    <div className="mt-6 rounded border border-emerald-400/35 bg-emerald-950/10 p-4">
      <h3 className="font-mono text-sm uppercase tracking-wide text-emerald-300">solution_lines</h3>
      <ol className="mt-4 grid gap-2 font-mono text-sm text-zinc-100">
        {lines.map((line, index) => (
          <li className="flex gap-3" key={`${line.id}-${index}`}>
            <span className="select-none text-zinc-500">{index + 1}</span>
            <span>{line.expression}</span>
          </li>
        ))}
      </ol>
    </div>
  );
}

function ScriptLog({artifact, script}: {artifact?: GenerationArtifact; script: LessonScript}) {
  return (
    <StageCard accent="sky" artifact={artifact} title="teacher_script">
      {script.status === "completed" ? (
        <ol className="mt-4 grid gap-4">
          {script.segments.map((segment, index) => (
            <li className="rounded border border-zinc-800 bg-zinc-950/45 p-3" key={segment.id}>
              <div className="flex items-start justify-between gap-4">
                <h4 className="text-sm font-semibold text-zinc-100">
                  {index + 1}. {segment.title}
                </h4>
                <span className="font-mono text-xs text-zinc-500">{segment.estimatedSeconds}s</span>
              </div>
              <p className="mt-2 text-sm leading-6 text-zinc-200">{segment.narration}</p>
              <p className="mt-3 break-words font-mono text-xs text-zinc-500">lines: {segment.mathLineIds.join(", ")}</p>
            </li>
          ))}
        </ol>
      ) : (
        <p className="mt-3 text-sm text-zinc-300">{script.unsupportedReason ?? "Script generation is not available for this lesson."}</p>
      )}
    </StageCard>
  );
}

function SpeechMarkupLog({artifact, narration}: {artifact?: GenerationArtifact; narration: LessonNarration}) {
  const segments = narration.segments ?? [];
  return (
    <StageCard accent="amber" artifact={artifact} title="elevenlabs_request">
      {segments.length > 0 ? (
        <ol className="mt-4 grid gap-3">
          {segments.map((segment, index) => (
            <li className="rounded border border-zinc-800 bg-zinc-950/45 p-3" key={segment.scriptSegmentId}>
              <div className="flex items-start justify-between gap-4">
                <h4 className="text-sm font-semibold text-zinc-100">
                  {index + 1}. {segment.title}
                </h4>
                <span className="font-mono text-xs text-zinc-500">{segment.stepId}</span>
              </div>
              <pre className="mt-3 max-h-40 overflow-auto whitespace-pre-wrap break-words rounded border border-zinc-800 bg-zinc-950/70 p-3 font-mono text-xs leading-5 text-zinc-300">
                {segment.speechText}
              </pre>
            </li>
          ))}
        </ol>
      ) : (
        <pre className="mt-3 max-h-56 overflow-auto whitespace-pre-wrap break-words rounded border border-zinc-800 bg-zinc-950/70 p-3 font-mono text-xs leading-5 text-zinc-300">
          {narration.speechText}
        </pre>
      )}
    </StageCard>
  );
}

function NarrationLog({
  artifact,
  narration
}: {
  artifact?: GenerationArtifact;
  narration: LessonNarration;
}) {
  const segments = narration.segments ?? [];
  return (
    <StageCard
      accent="fuchsia"
      artifact={artifact}
      title="elevenlabs_audio"
    >
      {segments.length > 0 ? (
        <ol className="mt-4 grid gap-3">
          {segments.map((segment, index) => (
            <NarrationSegmentLog
              index={index}
              key={segment.scriptSegmentId}
              segment={segment}
            />
          ))}
        </ol>
      ) : narration.status === "completed" && narration.audioBase64 ? (
        <div className="mt-4 grid gap-3">
          <audio className="w-full" controls src={`data:${narration.audioMimeType ?? "audio/mpeg"};base64,${narration.audioBase64}`}>
            <track kind="captions" />
          </audio>
          <NarrationMeta narration={narration} />
        </div>
      ) : (
        <p className="mt-3 text-sm text-zinc-300">{narration.unsupportedReason ?? "Narration is stored as a private media artifact."}</p>
      )}
      {artifact?.storageObjects?.[0] ? <ArtifactStorage object={artifact.storageObjects[0]} /> : null}
      {segments.length > 0 && narration.unsupportedReason ? (
        <p className="mt-3 rounded border border-amber-400/40 bg-amber-950/20 p-3 text-sm text-amber-100">{narration.unsupportedReason}</p>
      ) : null}
    </StageCard>
  );
}

function NarrationSegmentLog({
  index,
  segment
}: {
  index: number;
  segment: NarrationSegment;
}) {
  const hasInlineAudio = Boolean(segment.audioBase64);
  return (
    <li className="rounded border border-zinc-800 bg-zinc-950/45 p-3">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h4 className="text-sm font-semibold text-zinc-100">
            {index + 1}. {segment.title}
          </h4>
          <p className="mt-1 break-words font-mono text-xs text-zinc-500">
            {segment.stepId} / {Math.round(segment.durationSeconds ?? 0)}s
          </p>
        </div>
      </div>
      {hasInlineAudio ? (
        <audio className="mt-3 w-full" controls src={`data:${segment.audioMimeType ?? "audio/mpeg"};base64,${segment.audioBase64}`}>
          <track kind="captions" />
        </audio>
      ) : (
        <p className="mt-3 rounded border border-zinc-800 bg-zinc-950/50 p-3 text-sm text-zinc-400">Audio stored in private media storage.</p>
      )}
    </li>
  );
}

function AnimationPlanLog({
  actionDisabled = false,
  artifact,
  loading = false,
  onRun,
  plan,
  timeline
}: {
  actionDisabled?: boolean;
  artifact?: GenerationArtifact;
  loading?: boolean;
  onRun?: () => void;
  plan: AnimationPlan;
  timeline?: ResolvedAnimationTimeline;
}) {
  const resolvedByCue = new Map((timeline?.cues ?? []).map((cue) => [cue.cueId, cue]));
  return (
    <StageCard
      accent="violet"
      action={onRun ? <IconButton disabled={actionDisabled || loading} label="Regenerate animation plan" onClick={onRun}><RegenerateIcon /></IconButton> : null}
      artifact={artifact}
      loading={loading}
      title="animation_plan"
    >
      <div className="mt-4 overflow-x-auto">
        <table className="w-full min-w-[640px] border-separate border-spacing-y-2 text-left text-sm">
          <thead className="font-mono text-xs uppercase tracking-wide text-zinc-500">
            <tr>
              <th className="px-2 py-1">Time</th>
              <th className="px-2 py-1">Narration</th>
              <th className="px-2 py-1">Visual action</th>
            </tr>
          </thead>
          <tbody>
            {plan.cues.map((cue) => {
              const resolved = resolvedByCue.get(cue.id);
              return (
                <tr className="bg-zinc-950/45 text-zinc-200" key={cue.id}>
                  <td className="rounded-l border-y border-l border-zinc-800 px-2 py-2 font-mono text-xs text-zinc-400">
                    {resolved ? `${formatSeconds(resolved.animation.startSeconds)}-${formatSeconds(resolved.animation.endSeconds)}` : "unresolved"}
                  </td>
                  <td className="border-y border-zinc-800 px-2 py-2">{cue.trigger.text}</td>
                  <td className="rounded-r border-y border-r border-zinc-800 px-2 py-2 font-mono text-xs text-violet-200">
                    {cue.visual.action}
                    {cue.visual.target?.mathLineId ? ` -> ${cue.visual.target.mathLineId}` : ""}
                    {cue.visual.target?.fragment ? ` (${cue.visual.target.fragment})` : ""}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <details className="mt-3">
        <summary className="cursor-pointer font-mono text-xs uppercase tracking-wide text-zinc-500">raw plan</summary>
        <pre className="mt-2 max-h-56 overflow-auto whitespace-pre-wrap break-words rounded border border-zinc-800 bg-zinc-950/70 p-3 font-mono text-xs leading-5 text-zinc-300">
          {JSON.stringify(plan, null, 2)}
        </pre>
      </details>
    </StageCard>
  );
}

function TimelineLog({
  actionDisabled = false,
  artifact,
  loading = false,
  onRun,
  timeline
}: {
  actionDisabled?: boolean;
  artifact?: GenerationArtifact;
  loading?: boolean;
  onRun?: () => void;
  timeline: ResolvedAnimationTimeline;
}) {
  return (
    <StageCard
      accent="cyan"
      action={onRun ? <IconButton disabled={actionDisabled || loading} label="Regenerate resolved timeline" onClick={onRun}><RegenerateIcon /></IconButton> : null}
      artifact={artifact}
      loading={loading}
      title="resolved_timeline"
    >
      <div className="mt-4 grid gap-2">
        {timeline.cues.map((cue) => (
          <div className="grid gap-2 rounded border border-zinc-800 bg-zinc-950/45 p-3 text-sm sm:grid-cols-[7rem_1fr]" key={cue.cueId}>
            <span className="font-mono text-xs text-cyan-200">
              {formatSeconds(cue.animation.startSeconds)}-{formatSeconds(cue.animation.endSeconds)}
            </span>
            <div className="grid gap-2">
              <p className="text-zinc-200">{cue.narration.text}</p>
              <div className="h-2 rounded bg-zinc-900">
                <div
                  className="h-2 rounded bg-cyan-300"
                  style={{
                    marginLeft: `${Math.max(0, (cue.animation.startSeconds / timeline.durationSeconds) * 100)}%`,
                    width: `${Math.max(1, ((cue.animation.endSeconds - cue.animation.startSeconds) / timeline.durationSeconds) * 100)}%`
                  }}
                />
              </div>
            </div>
          </div>
        ))}
      </div>
    </StageCard>
  );
}

function RenderLog({
  actionDisabled = false,
  artifact,
  loading = false,
  onRun
}: {
  actionDisabled?: boolean;
  artifact: GenerationArtifact;
  loading?: boolean;
  onRun?: () => void;
}) {
  return (
    <StageCard
      accent="lime"
      action={onRun ? <IconButton disabled={actionDisabled || loading} label="Regenerate Motion Canvas render" onClick={onRun}><RegenerateIcon /></IconButton> : null}
      artifact={artifact}
      loading={loading}
      title="motion_canvas_render"
    >
      <p className="mt-3 text-sm text-zinc-300">
        {artifact.status === "completed" ? "Blackboard video render completed with narration and chalk SFX metadata." : artifact.errorMessage ?? "Render artifact is not current."}
      </p>
      {artifact.storageObjects?.[0] ? <ArtifactStorage object={artifact.storageObjects[0]} /> : null}
    </StageCard>
  );
}

function StageCard({
  accent = "zinc",
  action,
  artifact,
  children,
  loading,
  title
}: {
  accent?: Accent;
  action?: React.ReactNode;
  artifact?: GenerationArtifact;
  children: React.ReactNode;
  loading?: boolean;
  title: string;
}) {
  return (
    <div className={`mt-6 rounded border ${accentBorderClass(accent)} p-4`}>
      <div className="flex items-start justify-between gap-4">
        <div>
          <h3 className={`font-mono text-sm uppercase tracking-wide ${accentTextClass(accent)}`}>{title}</h3>
          {artifact ? <ArtifactMeta artifact={artifact} /> : null}
        </div>
        <div className="flex items-center gap-2">
          {artifact?.status === "stale" ? <StageBadge tone="amber">STALE</StageBadge> : null}
          {artifact?.status === "failed" ? <StageBadge tone="red">FAILED</StageBadge> : null}
          {loading ? <Spinner /> : null}
          {action}
        </div>
      </div>
      {artifact?.status === "stale" && artifact.staleReason ? (
        <p className="mt-3 rounded border border-amber-400/30 bg-amber-950/20 p-3 text-sm text-amber-100">{artifact.staleReason}</p>
      ) : null}
      {children}
    </div>
  );
}

function ArtifactMeta({artifact}: {artifact: GenerationArtifact}) {
  const provider = [artifact.provider, artifact.model].filter(Boolean).join(" / ");
  return (
    <p className="mt-2 break-words font-mono text-xs text-zinc-500">
      {artifact.status} / v{artifact.version}
      {artifact.cacheHit ? " / cache hit" : ""}
      {provider ? ` / ${provider}` : ""}
    </p>
  );
}

function NarrationMeta({narration}: {narration: LessonNarration}) {
  return (
    <p className="break-words font-mono text-xs text-zinc-500">
      voice: {narration.voiceId ?? "unknown"} / timing chars: {narration.normalizedAlignment?.characters.length ?? narration.alignment?.characters.length ?? 0}
    </p>
  );
}

function ArtifactStorage({object}: {object: NonNullable<GenerationArtifact["storageObjects"]>[number]}) {
  return (
    <p className="mt-3 break-words rounded border border-zinc-800 bg-zinc-950/50 p-3 font-mono text-xs text-zinc-500">
      storage: {object.bucket}/{object.path}
    </p>
  );
}

function StageBadge({children, tone}: {children: React.ReactNode; tone: "amber" | "red"}) {
  const className = tone === "amber" ? "border-amber-400/40 text-amber-200" : "border-red-400/50 text-red-200";
  return <span className={`rounded border px-2 py-1 font-mono text-[10px] font-semibold ${className}`}>{children}</span>;
}

function IconButton({children, disabled, label, onClick}: {children: React.ReactNode; disabled?: boolean; label: string; onClick?: () => void}) {
  return (
    <button
      aria-label={label}
      className="flex h-8 w-8 shrink-0 items-center justify-center rounded border border-zinc-700 text-zinc-300 transition hover:border-emerald-400/60 hover:bg-emerald-400/10 hover:text-emerald-200 disabled:opacity-40"
      disabled={disabled}
      onClick={onClick}
      title={label}
      type="button"
    >
      {children}
    </button>
  );
}

type Accent = "amber" | "cyan" | "fuchsia" | "lime" | "sky" | "violet" | "zinc";

function PendingLog({accent = "zinc", className = "", title}: {accent?: Accent; className?: string; title: string}) {
  return (
    <div className={`${className} rounded border ${accentBorderClass(accent)} p-4 backdrop-blur`}>
      <div className="flex items-center justify-between gap-4">
        <h3 className={`font-mono text-sm uppercase tracking-wide ${accentTextClass(accent)}`}>{title}</h3>
        <Spinner />
      </div>
    </div>
  );
}

function RunnableLog({
  accent = "zinc",
  className = "",
  disabled = false,
  onRun,
  title
}: {
  accent?: Accent;
  className?: string;
  disabled?: boolean;
  onRun?: () => void;
  title: string;
}) {
  return (
    <div className={`${className} rounded border ${accentBorderClass(accent)} p-4 backdrop-blur`}>
      <div className="flex items-center justify-between gap-4">
        <h3 className={`font-mono text-sm uppercase tracking-wide ${accentTextClass(accent)}`}>{title}</h3>
        <IconButton disabled={disabled} label={`Run ${title}`} onClick={onRun}>
          <RunIcon />
        </IconButton>
      </div>
    </div>
  );
}

function artifactForStage(generation: GenerationSnapshot | undefined, stage: string) {
  const artifacts = generation?.artifacts.filter((artifact) => artifact.stage === stage) ?? [];
  return artifacts.find((artifact) => artifact.isCurrent !== false) ?? artifacts[0];
}

function payloadForStage<T>(generation: GenerationSnapshot | undefined, stage: string): T | undefined {
  const artifact = artifactForStage(generation, stage);
  return artifact?.payload as T | undefined;
}

function formatSeconds(value: number) {
  return `${value.toFixed(1)}s`;
}

function accentTextClass(accent: Accent) {
  return {
    amber: "text-amber-300",
    cyan: "text-cyan-300",
    fuchsia: "text-fuchsia-300",
    lime: "text-lime-300",
    sky: "text-sky-300",
    violet: "text-violet-300",
    zinc: "text-zinc-100"
  }[accent];
}

function accentBorderClass(accent: Accent) {
  return {
    amber: "border-amber-400/35 bg-amber-950/10",
    cyan: "border-cyan-400/35 bg-cyan-950/10",
    fuchsia: "border-fuchsia-400/35 bg-fuchsia-950/10",
    lime: "border-lime-400/35 bg-lime-950/10",
    sky: "border-sky-400/35 bg-sky-950/10",
    violet: "border-violet-400/35 bg-violet-950/10",
    zinc: "border-zinc-700/80 bg-zinc-950/55"
  }[accent];
}

function RegenerateIcon() {
  return (
    <svg aria-hidden="true" className="h-4 w-4" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" viewBox="0 0 24 24">
      <path d="M21 12a9 9 0 1 1-2.6-6.4" />
      <path d="M21 3v6h-6" />
      <path d="m10 8 6 4-6 4V8z" />
    </svg>
  );
}

function RunIcon() {
  return (
    <svg aria-hidden="true" className="h-4 w-4" fill="currentColor" viewBox="0 0 24 24">
      <path d="M8 5v14l11-7z" />
    </svg>
  );
}

function Spinner() {
  return <span aria-label="Loading" className="h-4 w-4 animate-spin rounded-full border border-zinc-700 border-t-emerald-300" role="status" />;
}

function viewButtonClass(active: boolean) {
  return ["rounded-full px-4 py-2 font-medium transition", active ? "bg-zinc-800/80 text-emerald-300" : "text-zinc-400 hover:text-zinc-100"].join(" ");
}
