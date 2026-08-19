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
  onGenerateScript?: () => void;
  onRunStage?: (stage: string, options?: StageRunOptions) => void;
  speechMarkupLoading?: boolean;
  script?: LessonScript;
  scriptLoading?: boolean;
}) {
  const [activeView, setActiveView] = useState<"lesson" | "logs">("logs");
  const solutionLines = lesson ? flattenLessonMathLines(lesson) : [];
  const teacherScriptArtifact = artifactForStage(generation, "teacher_script");
  const speechMarkupArtifact = artifactForStage(generation, "elevenlabs_request");
  const narrationArtifact = artifactForStage(generation, "elevenlabs_audio");
  const effectiveScript = script ?? payloadForStage<LessonScript>(generation, "teacher_script");
  const effectiveNarration = narration ?? payloadForStage<LessonNarration>(generation, "elevenlabs_audio");
  const speechMarkupArtifactPayload = payloadForStage<LessonNarration>(generation, "elevenlabs_request");
  const speechMarkup = speechMarkupArtifactPayload ?? effectiveNarration;
  const animationPlanArtifact = artifactForStage(generation, "animation_plan");
  const resolvedTimelineArtifact = artifactForStage(generation, "resolved_timeline");
  const renderArtifact = artifactForStage(generation, "motion_canvas_render");
  const animationPlan = isAnimationPlanPayload(animationPlanArtifact?.payload)
    ? animationPlanArtifact.payload
    : undefined;
  const resolvedTimeline = isResolvedTimelinePayload(resolvedTimelineArtifact?.payload)
    ? resolvedTimelineArtifact.payload
    : undefined;
  const baseVideo = artifactForStage(generation, "base_video");
  const visibleRenderArtifact = baseVideo ?? renderArtifact;
  const elevenLabsRequestLoading = loadingStage === "elevenlabs_request" || loadingStage === "elevenlabs_audio";
  const elevenLabsAudioLoading = loadingStage === "elevenlabs_audio";

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
            <ScriptLog
              artifact={teacherScriptArtifact}
              disabled={actionDisabled || loadingStage === "teacher_script"}
              loading={loadingStage === "teacher_script"}
              onRun={onRunStage ? () => onRunStage("teacher_script", {force: true}) : onGenerateScript}
              script={effectiveScript}
            />
          ) : scriptLoading ? (
            <PendingLog accent="sky" className="mt-6" title="teacher_script" />
          ) : teacherScriptArtifact?.status === "failed" ? (
            <FailedStageLog
              accent="sky"
              artifact={teacherScriptArtifact}
              disabled={actionDisabled || !onRunStage || loadingStage === "teacher_script"}
              loading={loadingStage === "teacher_script"}
              onRun={onRunStage ? () => onRunStage("teacher_script", {force: true}) : undefined}
              title="teacher_script"
            />
          ) : lesson ? (
            <RunnableLog
              accent="sky"
              className="mt-6"
              disabled={actionDisabled || !onGenerateScript || loadingStage === "teacher_script"}
              loading={loadingStage === "teacher_script"}
              onRun={onGenerateScript}
              title="teacher_script"
            />
          ) : null}

          {speechMarkup?.speechText ? (
            <SpeechMarkupLog
              actionDisabled={actionDisabled}
              artifact={speechMarkupArtifact}
              loading={elevenLabsRequestLoading}
              narration={speechMarkup}
              onRun={onRunStage ? () => onRunStage("elevenlabs_audio", {force: true}) : undefined}
            />
          ) : speechMarkupLoading ? (
            <PendingLog accent="amber" className="mt-6" title="elevenlabs_request" />
          ) : speechMarkupArtifact?.status === "failed" ? (
            <FailedStageLog
              accent="amber"
              artifact={speechMarkupArtifact}
              disabled={actionDisabled || !onRunStage || elevenLabsRequestLoading}
              loading={elevenLabsRequestLoading}
              onRun={onRunStage ? () => onRunStage("elevenlabs_audio", {force: true}) : undefined}
              title="elevenlabs_request"
            />
          ) : effectiveScript?.status === "completed" ? (
            <RunnableLog
              accent="amber"
              className="mt-6"
              disabled={actionDisabled || !onRunStage || elevenLabsRequestLoading}
              loading={elevenLabsRequestLoading}
              onRun={onRunStage ? () => onRunStage("elevenlabs_audio") : undefined}
              title="elevenlabs_request"
            />
          ) : null}

          {effectiveNarration ? (
            <NarrationLog
              actionDisabled={actionDisabled}
              artifact={narrationArtifact}
              loading={elevenLabsAudioLoading || narrationLoading}
              narration={effectiveNarration}
              onRun={onRunStage ? () => onRunStage("elevenlabs_audio", {force: true}) : undefined}
            />
          ) : narrationLoading ? (
            <PendingLog accent="fuchsia" className="mt-6" title="elevenlabs_audio" />
          ) : narrationArtifact?.status === "failed" ? (
            <FailedStageLog
              accent="fuchsia"
              artifact={narrationArtifact}
              disabled={actionDisabled || !onRunStage || elevenLabsAudioLoading}
              loading={elevenLabsAudioLoading}
              onRun={onRunStage ? () => onRunStage("elevenlabs_audio", {force: true}) : undefined}
              title="elevenlabs_audio"
            />
          ) : null}

          {animationPlan ? (
            <AnimationPlanLog
              actionDisabled={actionDisabled}
              artifact={animationPlanArtifact}
              loading={loadingStage === "animation_plan"}
              onRun={onRunStage ? () => onRunStage("animation_plan", {force: true}) : undefined}
              plan={animationPlan}
              timeline={resolvedTimeline}
            />
          ) : animationPlanArtifact?.status === "failed" ? (
            <FailedStageLog
              accent="violet"
              artifact={animationPlanArtifact}
              disabled={actionDisabled || !onRunStage || loadingStage === "animation_plan"}
              loading={loadingStage === "animation_plan"}
              onRun={onRunStage ? () => onRunStage("animation_plan", {force: true}) : undefined}
              title="animation_plan"
            />
          ) : loadingStage === "animation_plan" ? (
            <PendingLog accent="violet" className="mt-6" title="animation_plan" />
          ) : effectiveNarration?.status === "completed" ? (
            <RunnableLog
              accent="violet"
              className="mt-6"
              disabled={actionDisabled || !onRunStage || loadingStage === "animation_plan"}
              loading={loadingStage === "animation_plan"}
              onRun={onRunStage ? () => onRunStage("animation_plan") : undefined}
              title="animation_plan"
            />
          ) : null}

          {resolvedTimeline ? (
            <TimelineLog
              actionDisabled={actionDisabled}
              artifact={resolvedTimelineArtifact}
              loading={loadingStage === "resolved_timeline"}
              onRun={onRunStage ? () => onRunStage("resolved_timeline", {force: true}) : undefined}
              timeline={resolvedTimeline}
            />
          ) : resolvedTimelineArtifact?.status === "failed" ? (
            <FailedStageLog
              accent="cyan"
              artifact={resolvedTimelineArtifact}
              disabled={actionDisabled || !onRunStage || loadingStage === "resolved_timeline"}
              loading={loadingStage === "resolved_timeline"}
              onRun={onRunStage ? () => onRunStage("resolved_timeline", {force: true}) : undefined}
              title="resolved_timeline"
            />
          ) : loadingStage === "resolved_timeline" ? (
            <PendingLog accent="cyan" className="mt-6" title="resolved_timeline" />
          ) : animationPlan ? (
            <RunnableLog
              accent="cyan"
              className="mt-6"
              disabled={actionDisabled || !onRunStage || loadingStage === "resolved_timeline"}
              loading={loadingStage === "resolved_timeline"}
              onRun={onRunStage ? () => onRunStage("resolved_timeline") : undefined}
              title="resolved_timeline"
            />
          ) : null}

          {visibleRenderArtifact ? (
            <RenderLog
              actionDisabled={actionDisabled}
              artifact={visibleRenderArtifact}
              loading={loadingStage === "motion_canvas_render"}
              narration={effectiveNarration}
              onRun={onRunStage ? () => onRunStage("motion_canvas_render", {force: true}) : undefined}
              timeline={resolvedTimeline}
            />
          ) : loadingStage === "motion_canvas_render" ? (
            <PendingLog accent="lime" className="mt-6" title="motion_canvas_render" />
          ) : resolvedTimeline ? (
            <RunnableLog
              accent="lime"
              className="mt-6"
              disabled={actionDisabled || !onRunStage || loadingStage === "motion_canvas_render"}
              loading={loadingStage === "motion_canvas_render"}
              onRun={onRunStage ? () => onRunStage("motion_canvas_render") : undefined}
              title="motion_canvas_render"
            >
              <RenderInputSummary narration={effectiveNarration} timeline={resolvedTimeline} />
            </RunnableLog>
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
          {storageObject?.signedUrl ? (
            <video className="aspect-video w-full rounded border border-zinc-800 bg-black" controls src={storageObject.signedUrl}>
              <track kind="captions" />
            </video>
          ) : (
            <>
              <p className="text-sm text-zinc-300">The render artifact is complete. Waiting for a private playback URL.</p>
            </>
          )}
          {storageObject ? <ArtifactStorage object={storageObject} /> : null}
        </div>
      ) : (
        <div className="flex min-h-56 items-center justify-center px-6 text-center text-sm leading-6 text-zinc-400">
          Run the pipeline from the Logs tab. The finished narrated lesson video will appear here.
        </div>
      )}
    </div>
  );
}

function AnswerLog({lesson}: {lesson: Lesson}) {
  return (
    <div className="rounded border border-zinc-700/80 bg-zinc-950/55 p-4 backdrop-blur">
      <StageTitle accent="zinc" title="answer" />
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
    <div className="relative mt-8 rounded border border-emerald-400/35 bg-emerald-950/10 p-4">
      <PipelineConnector />
      <StageTitle accent="lime" title="solution_lines" />
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

function ScriptLog({
  artifact,
  disabled = false,
  loading = false,
  onRun,
  script
}: {
  artifact?: GenerationArtifact;
  disabled?: boolean;
  loading?: boolean;
  onRun?: () => void;
  script: LessonScript;
}) {
  const stageLoading = loading || artifact?.status === "running";
  return (
    <StageCard
      accent="sky"
      action={onRun ? <IconButton disabled={disabled || stageLoading} label="Regenerate teacher_script" onClick={onRun}><RegenerateIcon /></IconButton> : null}
      artifact={artifact}
      loading={stageLoading}
      title="teacher_script"
    >
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

function SpeechMarkupLog({
  actionDisabled = false,
  artifact,
  loading = false,
  narration,
  onRun
}: {
  actionDisabled?: boolean;
  artifact?: GenerationArtifact;
  loading?: boolean;
  narration: LessonNarration;
  onRun?: () => void;
}) {
  const segments = narration.segments ?? [];
  const stageLoading = loading || artifact?.status === "running";
  return (
    <StageCard
      accent="amber"
      action={onRun ? <IconButton disabled={actionDisabled || stageLoading} label="Regenerate elevenlabs_request" onClick={onRun}><RegenerateIcon /></IconButton> : null}
      artifact={artifact}
      loading={stageLoading}
      title="elevenlabs_request"
    >
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
  actionDisabled = false,
  artifact,
  loading = false,
  narration,
  onRun
}: {
  actionDisabled?: boolean;
  artifact?: GenerationArtifact;
  loading?: boolean;
  narration: LessonNarration;
  onRun?: () => void;
}) {
  const segments = narration.segments ?? [];
  const stageLoading = loading || artifact?.status === "running";
  return (
    <StageCard
      accent="fuchsia"
      action={onRun ? <IconButton disabled={actionDisabled || stageLoading} label="Regenerate elevenlabs_audio" onClick={onRun}><RegenerateIcon /></IconButton> : null}
      artifact={artifact}
      loading={stageLoading}
      title="elevenlabs_audio"
    >
      {segments.length > 0 ? (
        <ol className="mt-4 grid gap-3">
          {segments.map((segment, index) => (
            <NarrationSegmentLog
              index={index}
              key={segment.scriptSegmentId}
              segment={segment}
              storageObject={storageObjectForSegment(artifact, segment.scriptSegmentId)}
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
        <p className="mt-3 text-sm text-zinc-300">{narration.unsupportedReason ?? "Waiting for a playback URL."}</p>
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
  segment,
  storageObject
}: {
  index: number;
  segment: NarrationSegment;
  storageObject?: NonNullable<GenerationArtifact["storageObjects"]>[number];
}) {
  const hasInlineAudio = Boolean(segment.audioBase64);
  const audioSrc = storageObject?.signedUrl ?? (hasInlineAudio ? `data:${segment.audioMimeType ?? "audio/mpeg"};base64,${segment.audioBase64}` : null);
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
      {audioSrc ? (
        <audio className="mt-3 w-full" controls src={audioSrc}>
          <track kind="captions" />
        </audio>
      ) : (
        <p className="mt-3 rounded border border-zinc-800 bg-zinc-950/50 p-3 text-sm text-zinc-400">Waiting for a private playback URL.</p>
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
  const cues = cuesForAnimationPlanLog(plan, timeline);
  const stageLoading = loading || artifact?.status === "running";
  return (
    <StageCard
      accent="violet"
      action={onRun ? <IconButton disabled={actionDisabled || stageLoading} label="Regenerate animation plan" onClick={onRun}><RegenerateIcon /></IconButton> : null}
      artifact={artifact}
      loading={stageLoading}
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
            {cues.map((cue) => {
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
  const stageLoading = loading || artifact?.status === "running";
  return (
    <StageCard
      accent="cyan"
      action={onRun ? <IconButton disabled={actionDisabled || stageLoading} label="Regenerate resolved timeline" onClick={onRun}><RegenerateIcon /></IconButton> : null}
      artifact={artifact}
      loading={stageLoading}
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
  narration,
  onRun,
  timeline
}: {
  actionDisabled?: boolean;
  artifact: GenerationArtifact;
  loading?: boolean;
  narration?: LessonNarration;
  onRun?: () => void;
  timeline?: ResolvedAnimationTimeline;
}) {
  const stageLoading = loading || artifact.status === "running";
  return (
    <StageCard
      accent="lime"
      action={onRun ? <IconButton disabled={actionDisabled || stageLoading} label="Regenerate Motion Canvas render" onClick={onRun}><RegenerateIcon /></IconButton> : null}
      artifact={artifact}
      loading={stageLoading}
      title="motion_canvas_render"
    >
      <p className="mt-3 text-sm text-zinc-300">
        {artifact.status === "completed" ? "Blackboard video render completed. Stored narration is included when playback URLs are available to the renderer." : artifact.errorMessage ?? "Render artifact is not current."}
      </p>
      {timeline ? <RenderInputSummary narration={narration} renderArtifact={artifact} timeline={timeline} /> : null}
      {artifact.storageObjects?.[0] ? <ArtifactStorage object={artifact.storageObjects[0]} /> : null}
    </StageCard>
  );
}

function RenderInputSummary({
  narration,
  renderArtifact,
  timeline
}: {
  narration?: LessonNarration;
  renderArtifact?: GenerationArtifact;
  timeline: ResolvedAnimationTimeline;
}) {
  const narrationSegments = narration?.segments?.length ?? 0;
  const renderProvider = [renderArtifact?.provider, renderArtifact?.model].filter(Boolean).join(" / ");
  return (
    <div className="mt-4 rounded border border-lime-400/20 bg-lime-950/5 p-3">
      <p className="font-mono text-xs uppercase tracking-wide text-lime-200">render input</p>
      <p className="mt-2 max-w-2xl text-sm leading-6 text-zinc-300">
        Motion Canvas receives the lesson, resolved timeline, and signed narration segment URLs. The renderer uses those inputs to
        draw the blackboard scene, place captions, and mux narration into the final MP4.
      </p>
      <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-3">
        <div className="rounded border border-zinc-800 bg-zinc-950/45 p-3">
          <dt className="font-mono text-xs uppercase tracking-wide text-zinc-500">Timeline</dt>
          <dd className="mt-1 text-zinc-100">{timeline.cues.length} cues / {formatSeconds(timeline.durationSeconds)}</dd>
        </div>
        <div className="rounded border border-zinc-800 bg-zinc-950/45 p-3">
          <dt className="font-mono text-xs uppercase tracking-wide text-zinc-500">Narration</dt>
          <dd className="mt-1 text-zinc-100">{narrationSegments || "pending"} segments</dd>
        </div>
        <div className="rounded border border-zinc-800 bg-zinc-950/45 p-3">
          <dt className="font-mono text-xs uppercase tracking-wide text-zinc-500">Renderer</dt>
          <dd className="mt-1 break-words text-zinc-100">{renderProvider || "motion_canvas command adapter"}</dd>
        </div>
      </dl>
    </div>
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
  const isLoading = loading || artifact?.status === "running";
  return (
    <div className={`relative mt-8 rounded border ${accentBorderClass(accent)} p-4`}>
      <PipelineConnector />
      <div className="flex items-start justify-between gap-4">
        <div>
          <StageTitle accent={accent} title={title} />
          {artifact ? <ArtifactMeta artifact={artifact} /> : null}
        </div>
        <div className="flex items-center gap-2">
          {artifact?.status === "stale" ? <StageBadge tone="amber">STALE</StageBadge> : null}
          {artifact?.status === "failed" ? <StageBadge tone="red">FAILED</StageBadge> : null}
          {isLoading ? <Spinner /> : null}
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
  const lastRanAt = formatArtifactTimestamp(artifact.completedAt ?? artifact.createdAt);
  return (
    <p className="mt-2 break-words font-mono text-xs text-zinc-500">
      {artifact.status} / v{artifact.version}
      {lastRanAt ? ` / last ran ${lastRanAt}` : ""}
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

function storageObjectForSegment(artifact: GenerationArtifact | undefined, scriptSegmentId: string) {
  return artifact?.storageObjects?.find((object) => object.metadata?.scriptSegmentId === scriptSegmentId);
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
    <div className={`${className} relative rounded border ${accentBorderClass(accent)} p-4 backdrop-blur`}>
      {title !== "answer" ? <PipelineConnector /> : null}
      <div className="flex items-center justify-between gap-4">
        <StageTitle accent={accent} title={title} />
        <Spinner />
      </div>
    </div>
  );
}

function RunnableLog({
  accent = "zinc",
  children,
  className = "",
  disabled = false,
  loading = false,
  onRun,
  title
}: {
  accent?: Accent;
  children?: React.ReactNode;
  className?: string;
  disabled?: boolean;
  loading?: boolean;
  onRun?: () => void;
  title: string;
}) {
  return (
    <div className={`${className} relative rounded border ${accentBorderClass(accent)} p-4 backdrop-blur`}>
      <PipelineConnector />
      <div className="flex items-center justify-between gap-4">
        <StageTitle accent={accent} title={title} />
        <div className="flex items-center gap-2">
          {loading ? <Spinner /> : null}
          <IconButton disabled={disabled || loading || !onRun} label={`Run ${title}`} onClick={onRun}>
            <RunIcon />
          </IconButton>
        </div>
      </div>
      {children}
    </div>
  );
}

function FailedStageLog({
  accent = "zinc",
  artifact,
  disabled = false,
  loading = false,
  onRun,
  title
}: {
  accent?: Accent;
  artifact: GenerationArtifact;
  disabled?: boolean;
  loading?: boolean;
  onRun?: () => void;
  title: string;
}) {
  const stageLoading = loading || artifact.status === "running";
  return (
    <StageCard
      accent={accent}
      action={onRun ? <IconButton disabled={disabled || stageLoading} label={`Run ${title}`} onClick={onRun}><RunIcon /></IconButton> : null}
      artifact={artifact}
      loading={stageLoading}
      title={title}
    >
      <p className="mt-3 rounded border border-red-400/30 bg-red-950/20 p-3 text-sm text-red-100">
        {artifact.errorMessage ?? "This stage failed."}
      </p>
    </StageCard>
  );
}

function artifactForStage(generation: GenerationSnapshot | undefined, stage: string) {
  const artifacts = generation?.artifacts.filter((artifact) => artifact.stage === stage) ?? [];
  return artifacts.find((artifact) => artifact.isCurrent !== false) ?? artifacts.at(-1);
}

function payloadForStage<T>(generation: GenerationSnapshot | undefined, stage: string): T | undefined {
  const artifact = artifactForStage(generation, stage);
  return artifact?.payload as T | undefined;
}

function isAnimationPlanPayload(payload: unknown): payload is AnimationPlan {
  return (
    typeof payload === "object" &&
    payload !== null &&
    Array.isArray((payload as {cues?: unknown}).cues)
  );
}

function isResolvedTimelinePayload(payload: unknown): payload is ResolvedAnimationTimeline {
  return (
    typeof payload === "object" &&
    payload !== null &&
    Array.isArray((payload as {cues?: unknown}).cues) &&
    typeof (payload as {durationSeconds?: unknown}).durationSeconds === "number"
  );
}

function cuesForAnimationPlanLog(plan: AnimationPlan, timeline?: ResolvedAnimationTimeline) {
  if (!timeline) {
    return plan.cues;
  }
  const planCueById = new Map(plan.cues.map((cue) => [cue.id, cue]));
  const orderedCues = timeline.cues
    .map((cue) => planCueById.get(cue.cueId))
    .filter((cue): cue is AnimationPlan["cues"][number] => Boolean(cue));
  const orderedIds = new Set(orderedCues.map((cue) => cue.id));
  return [
    ...orderedCues,
    ...plan.cues.filter((cue) => !orderedIds.has(cue.id)),
  ];
}

function formatSeconds(value: number) {
  return `${value.toFixed(1)}s`;
}

function StageTitle({accent, title}: {accent: Accent; title: string}) {
  return (
    <div className="flex min-w-0 items-center gap-2">
      <StageInfo title={title} />
      <h3 className={`font-mono text-sm uppercase tracking-wide ${accentTextClass(accent)}`}>{title}</h3>
    </div>
  );
}

function StageInfo({title}: {title: string}) {
  const description = stageDescriptions[title] ?? "This log shows one artifact boundary in the generation pipeline.";
  return (
    <span className="group/info relative inline-flex h-5 w-5 shrink-0 items-center justify-center">
      <span
        aria-label={`${title} info`}
        className="flex h-4 w-4 items-center justify-center rounded-full border border-zinc-700 font-mono text-[10px] font-semibold text-zinc-500 transition group-hover/info:border-emerald-400/60 group-hover/info:text-emerald-300"
        tabIndex={0}
      >
        i
      </span>
      <span className="pointer-events-none absolute left-0 top-7 z-30 hidden w-80 rounded border border-zinc-700 bg-[#090d14] p-3 text-left text-xs leading-5 text-zinc-200 shadow-2xl shadow-black/60 group-hover/info:block group-focus-within/info:block">
        {description}
      </span>
    </span>
  );
}

const stageDescriptions: Record<string, string> = {
  answer: "The API normalizes the equation, verifies it is a quadratic in x, and uses deterministic SymPy-backed code to compute coefficients and exact roots. No LLM decides the math.",
  solution_lines: "The lesson builder converts the solved quadratic into stable math-line IDs. These lines become the canonical board work for narration, animation planning, and Motion Canvas rendering.",
  teacher_script: "OpenAI receives the deterministic lesson structure and writes concise teaching narration. The script must reference existing teaching steps and math-line IDs; it cannot invent math.",
  elevenlabs_request: "The speech-markup provider turns the teacher script into ElevenLabs-ready conversational text with SSML break tags. This is the exact request-shaped text used before audio generation.",
  elevenlabs_audio: "ElevenLabs generates per-step narration audio and character alignment. The MP3 segments are stored in private Supabase Storage and exposed through signed playback URLs.",
  animation_plan: "The animation planner uses the lesson, script, and narration text to choose semantic visual actions like write, highlight, underline, or box. It does not create Motion Canvas code.",
  resolved_timeline: "Deterministic resolver code maps planner trigger phrases to ElevenLabs character timestamps and creates exact animation, caption, and chalk-SFX windows.",
  motion_canvas_render: "The API calls the configured Motion Canvas command adapter. It renders the blackboard scene from the resolved timeline, downloads signed narration segments, and muxes the MP4 with ffmpeg."
};

function PipelineConnector() {
  return (
    <div aria-hidden className="pointer-events-none absolute -top-8 left-1/2 flex h-8 -translate-x-1/2 flex-col items-center justify-center">
      <span className="h-2 w-2 rounded-full border border-cyan-300/45 bg-[#090d14] shadow-[0_0_10px_rgba(103,232,249,0.18)]" />
      <span className="h-4 w-px bg-gradient-to-b from-cyan-300/45 via-emerald-300/35 to-cyan-300/45" />
      <span className="h-2 w-2 rounded-full border border-emerald-300/45 bg-[#090d14] shadow-[0_0_10px_rgba(110,231,183,0.18)]" />
    </div>
  );
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

function Spinner({className = ""}: {className?: string}) {
  return (
    <svg
      aria-label="Loading"
      className={`h-4 w-4 animate-spin text-emerald-300 ${className}`}
      fill="none"
      role="status"
      viewBox="0 0 24 24"
    >
      <circle className="opacity-25" cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="3" />
      <path className="opacity-90" d="M21 12a9 9 0 0 0-9-9" stroke="currentColor" strokeLinecap="round" strokeWidth="3" />
    </svg>
  );
}

function formatArtifactTimestamp(value: string | null | undefined) {
  if (!value) {
    return "";
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "";
  }
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");
  return `${year}-${month}-${day} ${hours}:${minutes}`;
}

function viewButtonClass(active: boolean) {
  return ["rounded-full px-4 py-2 font-medium transition", active ? "bg-zinc-800/80 text-emerald-300" : "text-zinc-400 hover:text-zinc-100"].join(" ");
}
