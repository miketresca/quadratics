"use client";

import type {
  AnimationPlan,
  GenerationArtifact,
  GenerationSnapshot,
  Lesson,
  LessonNarration,
  RealWorldContext,
  LessonScript,
  NarrationSegment,
  ResolvedAnimationTimeline
} from "@quadratics/types";
import {useRef, useState} from "react";

import {flattenLessonMathLines} from "@/lib/lesson-view";

type HeyGenAvatarModel = "avatar_iii" | "avatar_iv" | "avatar_v";
type StageRunOptions = {force?: boolean; avatarModel?: HeyGenAvatarModel; includeAvatar?: boolean};
const HEYGEN_AVATAR_MODELS: Array<{
  id: HeyGenAvatarModel;
  label: string;
  rate: number;
  note: string;
}> = [
  {
    id: "avatar_iii",
    label: "Avatar III",
    note: "lowest cost",
    rate: Number(process.env.NEXT_PUBLIC_HEYGEN_AVATAR_III_COST_PER_SECOND_USD ?? "0.0167")
  },
  {
    id: "avatar_iv",
    label: "Avatar IV",
    note: "v3 default",
    rate: Number(process.env.NEXT_PUBLIC_HEYGEN_AVATAR_IV_COST_PER_SECOND_USD ?? "0.0667")
  },
  {
    id: "avatar_v",
    label: "Avatar V",
    note: "highest fidelity",
    rate: Number(process.env.NEXT_PUBLIC_HEYGEN_AVATAR_V_COST_PER_SECOND_USD ?? "0.0667")
  }
];

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
  const [pendingAvatarRun, setPendingAvatarRun] = useState<{force: boolean} | null>(null);
  const [pendingRenderRun, setPendingRenderRun] = useState<{force: boolean} | null>(null);
  const [selectedAvatarModel, setSelectedAvatarModel] = useState<HeyGenAvatarModel>("avatar_iii");
  const lessonSupportsPipeline = lesson?.status === "completed";
  const pipelineGeneration = lessonSupportsPipeline ? generation : undefined;
  const solutionLines = lessonSupportsPipeline && lesson ? flattenLessonMathLines(lesson) : [];
  const teacherScriptArtifact = artifactForStage(pipelineGeneration, "teacher_script");
  const realWorldContextArtifact = artifactForStage(pipelineGeneration, "real_world_context");
  const speechMarkupArtifact = artifactForStage(pipelineGeneration, "elevenlabs_request");
  const narrationArtifact = artifactForStage(pipelineGeneration, "elevenlabs_audio");
  const avatarArtifact = artifactForStage(pipelineGeneration, "heygen_avatar");
  const effectiveScript = lessonSupportsPipeline
    ? script ?? payloadForStage<LessonScript>(pipelineGeneration, "teacher_script")
    : undefined;
  const effectiveNarration = lessonSupportsPipeline
    ? narration ?? payloadForStage<LessonNarration>(pipelineGeneration, "elevenlabs_audio")
    : undefined;
  const speechMarkupArtifactPayload = payloadForStage<LessonNarration>(pipelineGeneration, "elevenlabs_request");
  const realWorldContext = payloadForStage<RealWorldContext>(pipelineGeneration, "real_world_context");
  const speechMarkup = speechMarkupArtifactPayload ?? effectiveNarration;
  const animationPlanArtifact = artifactForStage(pipelineGeneration, "animation_plan");
  const resolvedTimelineArtifact = artifactForStage(pipelineGeneration, "resolved_timeline");
  const renderArtifact = artifactForStage(pipelineGeneration, "motion_canvas_render");
  const animationPlan = isAnimationPlanPayload(animationPlanArtifact?.payload)
    ? animationPlanArtifact.payload
    : undefined;
  const resolvedTimeline = isResolvedTimelinePayload(resolvedTimelineArtifact?.payload)
    ? resolvedTimelineArtifact.payload
    : undefined;
  const baseVideo = artifactForStage(pipelineGeneration, "base_video");
  const visibleRenderArtifact = baseVideo ?? renderArtifact;
  const elevenLabsRequestLoading = loadingStage === "elevenlabs_request" || loadingStage === "elevenlabs_audio";
  const elevenLabsAudioLoading = loadingStage === "elevenlabs_audio";
  const realWorldContextLoading = loadingStage === "real_world_context";
  const avatarLoading = loadingStage === "heygen_avatar";
  const avatarEstimate = estimateHeyGenCost(effectiveNarration, selectedAvatarModel);
  const hasCompletedAvatar = avatarArtifact?.status === "completed";

  function requestAvatarRun(force = false) {
    setPendingAvatarRun({force});
  }

  function confirmAvatarRun() {
    const force = pendingAvatarRun?.force;
    setPendingAvatarRun(null);
    onRunStage?.("heygen_avatar", {avatarModel: selectedAvatarModel, force});
  }

  function requestRenderRun(force = false) {
    if (hasCompletedAvatar) {
      setPendingRenderRun({force});
      return;
    }
    onRunStage?.("motion_canvas_render", {force, includeAvatar: false});
  }

  function confirmRenderRun(includeAvatar: boolean) {
    const force = pendingRenderRun?.force;
    setPendingRenderRun(null);
    onRunStage?.("motion_canvas_render", {force, includeAvatar});
  }

  return (
    <section className="mx-auto mt-6 max-w-3xl" aria-live="polite">
      <div className="mb-4 flex flex-col items-center justify-center gap-3 sm:flex-row">
        <div className="grid w-64 grid-cols-2 rounded border border-zinc-800 bg-zinc-950/70 p-1 text-sm shadow-xl shadow-black/30">
          <button className={viewButtonClass(activeView === "lesson")} onClick={() => setActiveView("lesson")} type="button">
            Lesson
          </button>
          <button className={viewButtonClass(activeView === "logs")} onClick={() => setActiveView("logs")} type="button">
            Logs
          </button>
        </div>
      </div>

      {activeView === "lesson" ? (
        <LessonPreview
          artifact={baseVideo}
          context={realWorldContext}
          contextArtifact={realWorldContextArtifact}
          contextLoading={realWorldContextLoading}
          lesson={lesson}
          loading={loadingStage === "motion_canvas_render"}
        />
      ) : (
        <>
          {lesson ? <AnswerLog lesson={lesson} /> : <PendingLog title="answer" />}

          {solutionLines.length > 0 ? <SolutionLinesLog lines={solutionLines} /> : lesson ? null : <PendingLog className="mt-6" title="solution_lines" />}

          {realWorldContext ? (
            <RealWorldContextLog
              artifact={realWorldContextArtifact}
              context={realWorldContext}
              disabled={actionDisabled || !onRunStage || realWorldContextLoading}
              loading={realWorldContextLoading}
              onRun={onRunStage ? () => onRunStage("real_world_context", {force: true}) : undefined}
            />
          ) : realWorldContextArtifact?.status === "failed" ? (
            <FailedStageLog
              accent="cyan"
              artifact={realWorldContextArtifact}
              disabled={actionDisabled || !onRunStage || realWorldContextLoading}
              loading={realWorldContextLoading}
              onRun={onRunStage ? () => onRunStage("real_world_context", {force: true}) : undefined}
              title="real_world_context"
            />
          ) : realWorldContextLoading ? (
            <PendingLog accent="cyan" className="mt-6" title="real_world_context" />
          ) : lessonSupportsPipeline ? (
            <RunnableLog
              accent="cyan"
              className="mt-6"
              disabled={actionDisabled || !onRunStage || realWorldContextLoading}
              loading={realWorldContextLoading}
              onRun={onRunStage ? () => onRunStage("real_world_context") : undefined}
              title="real_world_context"
            >
              <p className="mt-3 rounded border border-cyan-400/20 bg-cyan-950/10 p-3 text-sm text-zinc-300">
                Optional lesson enrichment. Generates a compact real-world example for the Lesson tab without changing the video pipeline.
              </p>
            </RunnableLog>
          ) : null}

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
          ) : lessonSupportsPipeline ? (
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

          {avatarArtifact ? (
            <AvatarLog
              actionDisabled={actionDisabled}
              artifact={avatarArtifact}
              estimate={avatarEstimate}
              loading={avatarLoading}
              onModelChange={setSelectedAvatarModel}
              onRun={onRunStage ? () => requestAvatarRun(true) : undefined}
              selectedModel={selectedAvatarModel}
            />
          ) : avatarLoading ? (
            <PendingLog accent="pink" className="mt-6" title="heygen_avatar" />
          ) : effectiveNarration?.status === "completed" ? (
            <RunnableLog
              accent="pink"
              className="mt-6"
              disabled={actionDisabled || !onRunStage || avatarLoading}
              loading={avatarLoading}
              onRun={onRunStage ? () => requestAvatarRun(false) : undefined}
              title="heygen_avatar"
            >
              <AvatarModelSelector onChange={setSelectedAvatarModel} value={selectedAvatarModel} />
              <AvatarRunSummary estimate={avatarEstimate} model={selectedAvatarModel} />
            </RunnableLog>
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
              onOpenLesson={() => setActiveView("lesson")}
              onRun={onRunStage ? () => requestRenderRun(true) : undefined}
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
              onRun={onRunStage ? () => requestRenderRun(false) : undefined}
              title="motion_canvas_render"
            >
              <RenderInputSummary narration={effectiveNarration} timeline={resolvedTimeline} />
            </RunnableLog>
          ) : null}
        </>
      )}
      {pendingAvatarRun ? (
        <AvatarRunConfirm
          estimate={avatarEstimate}
          force={pendingAvatarRun.force}
          onCancel={() => setPendingAvatarRun(null)}
          onConfirm={confirmAvatarRun}
          selectedModel={selectedAvatarModel}
        />
      ) : null}
      {pendingRenderRun ? (
        <RenderRunConfirm
          force={pendingRenderRun.force}
          onCancel={() => setPendingRenderRun(null)}
          onConfirm={confirmRenderRun}
        />
      ) : null}
    </section>
  );
}

function LessonPreview({
  artifact,
  context,
  contextArtifact,
  contextLoading,
  lesson,
  loading
}: {
  artifact?: GenerationArtifact;
  context?: RealWorldContext;
  contextArtifact?: GenerationArtifact;
  contextLoading?: boolean;
  lesson: Lesson | null;
  loading?: boolean;
}) {
  const storageObject = artifact?.storageObjects?.[0];
  return (
    <div className="grid gap-4">
      <div className="min-h-64 rounded border border-zinc-800 bg-zinc-950/25 p-4" aria-label="Video Solution">
        <div className="mb-4 flex items-center justify-between border-b border-zinc-800 pb-3">
          <div>
            <h2 className="font-mono text-sm font-semibold uppercase tracking-wide text-zinc-100">Video Solution</h2>
            <p className="mt-1 text-xs text-zinc-500">Rendered lesson playback</p>
          </div>
          {artifact?.status === "completed" ? (
            <span className="rounded border border-lime-400/30 px-2 py-1 font-mono text-[10px] uppercase tracking-wide text-lime-200">
              Ready
            </span>
          ) : null}
        </div>
        {loading ? (
          <div className="flex min-h-56 items-center justify-center gap-3 text-sm text-zinc-300">
            <Spinner />
            rendering lesson video
          </div>
        ) : artifact?.status === "completed" ? (
          <div className="grid min-h-56 content-center gap-3">
            {storageObject?.signedUrl ? (
              <video className="aspect-video w-full rounded border border-zinc-800 bg-black" controls src={storageObject.signedUrl}>
                <track kind="captions" />
              </video>
            ) : (
              <>
                <p className="text-sm text-zinc-300">The render artifact is complete. Waiting for a private playback URL.</p>
              </>
            )}
          </div>
        ) : (
          <div className="flex min-h-56 items-center justify-center px-6 text-center text-sm leading-6 text-zinc-400">
            Run the pipeline from the Logs tab. The finished narrated lesson video will appear here.
          </div>
        )}
      </div>
      {lesson?.status === "completed" ? (
        <IRLExamplePanel
          context={context}
          contextArtifact={contextArtifact}
          lesson={lesson}
          loading={contextLoading}
        />
      ) : null}
    </div>
  );
}

function IRLExamplePanel({
  context,
  contextArtifact,
  lesson,
  loading
}: {
  context?: RealWorldContext;
  contextArtifact?: GenerationArtifact;
  lesson: Lesson;
  loading?: boolean;
}) {
  return (
    <section className="overflow-hidden rounded border border-cyan-400/25 bg-cyan-950/10 backdrop-blur" aria-label="IRL Example">
      <div className="flex items-center justify-between gap-4 border-b border-zinc-800/80 p-4">
        <div>
          <h2 className="font-mono text-sm font-semibold uppercase tracking-wide text-zinc-100">IRL Example</h2>
          <p className="mt-1 text-xs text-zinc-500">Graph + optional Algebra 1 context</p>
        </div>
        {loading ? (
          <span className="inline-flex items-center gap-2 rounded border border-cyan-400/30 px-2 py-1 font-mono text-[10px] uppercase tracking-wide text-cyan-100">
            <Spinner />
            Generating
          </span>
        ) : context?.status === "completed" ? (
          <span className="rounded border border-cyan-400/30 px-2 py-1 font-mono text-[10px] uppercase tracking-wide text-cyan-100">
            Ready
          </span>
        ) : null}
      </div>
      <div className="grid gap-4 p-4">
        <GraphExplorer lesson={lesson} />
        {context?.status === "completed" ? (
          <div className="grid gap-3 border-t border-zinc-800/80 pt-4">
            <h3 className="text-lg font-semibold text-zinc-100">{context.title}</h3>
            <p className="text-sm leading-6 text-zinc-300">{context.scenario}</p>
            <p className="rounded border border-cyan-400/20 bg-black/25 p-3 text-sm leading-6 text-cyan-100">{context.takeaway}</p>
          </div>
        ) : contextArtifact?.status === "failed" ? (
          <p className="rounded border border-red-400/30 bg-red-950/20 p-3 text-sm text-red-100">
            {contextArtifact.errorMessage ?? "Could not generate the lesson context."}
          </p>
        ) : (
          <p className="rounded border border-zinc-800 bg-black/25 p-3 text-sm leading-6 text-zinc-400">
            Run real_world_context from the Logs tab to generate a short example for this lesson. This does not affect the video pipeline.
          </p>
        )}
      </div>
    </section>
  );
}

function GraphExplorer({lesson}: {lesson: Lesson}) {
  const model = parabolaModel(lesson);
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);
  if (!model) {
    return null;
  }
  const pointCount = model.points.length;
  const hovered = hoverIndex === null ? model.vertexPoint : model.points[hoverIndex] ?? model.vertexPoint;

  function updateHover(clientX: number, rect: DOMRect) {
    const ratio = Math.min(1, Math.max(0, (clientX - rect.left) / rect.width));
    setHoverIndex(Math.round(ratio * (pointCount - 1)));
  }

  return (
    <div className="overflow-hidden rounded border border-zinc-800 bg-black/25" aria-label="Interactive graph">
      <div className="flex flex-col gap-3 border-b border-zinc-800/80 p-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h3 className="font-mono text-xs font-semibold uppercase tracking-wide text-zinc-300">Graph</h3>
          <p className="mt-1 text-xs text-zinc-500">{lesson.normalizedEquation}</p>
        </div>
        <dl className="grid grid-cols-3 gap-2 text-right font-mono text-[11px] uppercase tracking-wide text-zinc-500">
          <div>
            <dt>Vertex</dt>
            <dd className="mt-1 text-emerald-200">({formatNumber(model.vertex.x)}, {formatNumber(model.vertex.y)})</dd>
          </div>
          <div>
            <dt>Axis</dt>
            <dd className="mt-1 text-zinc-200">x = {formatNumber(model.vertex.x)}</dd>
          </div>
          <div>
            <dt>Opens</dt>
            <dd className="mt-1 text-zinc-200">{model.a > 0 ? "up" : "down"}</dd>
          </div>
        </dl>
      </div>
      <div className="grid gap-4 p-4 md:grid-cols-[minmax(0,1fr)_180px]">
        <svg
          className="aspect-[16/9] w-full rounded border border-zinc-800 bg-[linear-gradient(rgba(255,255,255,0.04)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.04)_1px,transparent_1px)] [background-size:36px_36px,36px_36px]"
          onPointerLeave={() => setHoverIndex(null)}
          onPointerMove={(event) => updateHover(event.clientX, event.currentTarget.getBoundingClientRect())}
          role="img"
          viewBox={`0 0 ${CHART_WIDTH} ${CHART_HEIGHT}`}
        >
          <line className="stroke-zinc-600/70" x1={model.xAxis.x1} x2={model.xAxis.x2} y1={model.xAxis.y1} y2={model.xAxis.y2} />
          <line className="stroke-zinc-600/70" x1={model.yAxis.x1} x2={model.yAxis.x2} y1={model.yAxis.y1} y2={model.yAxis.y2} />
          <path className="fill-none stroke-emerald-300 drop-shadow-[0_0_10px_rgba(110,231,183,0.55)]" d={model.path} strokeLinecap="round" strokeWidth="3" />
          <line className="stroke-emerald-300/30" x1={hovered.screenX} x2={hovered.screenX} y1={CHART_PADDING} y2={CHART_HEIGHT - CHART_PADDING} strokeDasharray="4 6" />
          {model.visibleRoots.map((root) => (
            <circle className="fill-cyan-200 stroke-black" cx={root.screenX} cy={root.screenY} key={root.x} r="5" strokeWidth="2" />
          ))}
          <circle className="fill-amber-200 stroke-black" cx={model.vertexPoint.screenX} cy={model.vertexPoint.screenY} r="5" strokeWidth="2" />
          <circle className="fill-emerald-100 stroke-black" cx={hovered.screenX} cy={hovered.screenY} r="6" strokeWidth="2" />
        </svg>
        <div className="grid content-between gap-3 rounded border border-zinc-800 bg-zinc-950/70 p-3">
          <dl className="grid gap-3 text-sm">
            <div>
              <dt className="font-mono text-[10px] uppercase tracking-wide text-zinc-500">Hover point</dt>
              <dd className="mt-1 font-mono text-zinc-100">({formatNumber(hovered.x)}, {formatNumber(hovered.y)})</dd>
            </div>
            <div>
              <dt className="font-mono text-[10px] uppercase tracking-wide text-zinc-500">Roots</dt>
              <dd className="mt-1 text-zinc-100">{model.realRootValues.length > 0 ? model.realRootValues.map((root) => formatNumber(root)).join(", ") : "no real roots"}</dd>
            </div>
          </dl>
          <p className="text-xs leading-5 text-zinc-500">Move across the visible branch to inspect the quadratic output at different x-values.</p>
        </div>
      </div>
    </div>
  );
}

const CHART_WIDTH = 720;
const CHART_HEIGHT = 405;
const CHART_PADDING = 38;

type ChartPoint = {
  x: number;
  y: number;
  screenX: number;
  screenY: number;
};

function parabolaModel(lesson: Lesson) {
  const a = parseMathNumber(lesson.coefficients.a.expression);
  const b = parseMathNumber(lesson.coefficients.b.expression);
  const c = parseMathNumber(lesson.coefficients.c.expression);
  if (a === null || b === null || c === null || a === 0) {
    return null;
  }
  const vertexX = -b / (2 * a);
  const vertexY = evaluateQuadratic(a, b, c, vertexX);
  const realRootValues = lesson.solutions
    .map((solution) => parseMathNumber(solution.expression))
    .filter((value): value is number => value !== null);
  const importantXs = [vertexX, ...realRootValues, 0].filter(Number.isFinite);
  const maxDistance = Math.max(3, ...importantXs.map((value) => Math.abs(value - vertexX)));
  const xPadding = Math.max(1, maxDistance * 0.2);
  const xMin = Math.min(...importantXs, vertexX) - xPadding;
  const xMax = Math.max(...importantXs, vertexX + maxDistance) + xPadding;
  const rawPoints = Array.from({length: 121}, (_, index) => {
    const ratio = index / 120;
    const x = xMin + (xMax - xMin) * ratio;
    return {x, y: evaluateQuadratic(a, b, c, x)};
  });
  const yValues = [...rawPoints.map((point) => point.y), vertexY, 0];
  const yMinRaw = Math.min(...yValues);
  const yMaxRaw = Math.max(...yValues);
  const yPad = Math.max(1, (yMaxRaw - yMinRaw) * 0.14);
  const yMin = yMinRaw - yPad;
  const yMax = yMaxRaw + yPad;

  const toScreen = (x: number, y: number): ChartPoint => ({
    x,
    y,
    screenX: scale(x, xMin, xMax, CHART_PADDING, CHART_WIDTH - CHART_PADDING),
    screenY: scale(y, yMin, yMax, CHART_HEIGHT - CHART_PADDING, CHART_PADDING)
  });
  const points = rawPoints.map((point) => toScreen(point.x, point.y));
  return {
    a,
    vertex: {x: vertexX, y: vertexY},
    vertexPoint: toScreen(vertexX, vertexY),
    realRootValues,
    visibleRoots: realRootValues
      .filter((root) => root >= xMin && root <= xMax)
      .map((root) => toScreen(root, 0)),
    points,
    path: points.map((point, index) => `${index === 0 ? "M" : "L"} ${point.screenX.toFixed(2)} ${point.screenY.toFixed(2)}`).join(" "),
    xAxis: {
      x1: CHART_PADDING,
      x2: CHART_WIDTH - CHART_PADDING,
      y1: scale(0, yMin, yMax, CHART_HEIGHT - CHART_PADDING, CHART_PADDING),
      y2: scale(0, yMin, yMax, CHART_HEIGHT - CHART_PADDING, CHART_PADDING)
    },
    yAxis: {
      x1: scale(0, xMin, xMax, CHART_PADDING, CHART_WIDTH - CHART_PADDING),
      x2: scale(0, xMin, xMax, CHART_PADDING, CHART_WIDTH - CHART_PADDING),
      y1: CHART_PADDING,
      y2: CHART_HEIGHT - CHART_PADDING
    }
  };
}

function parseMathNumber(expression: string): number | null {
  const normalized = expression.replace(/\s/g, "");
  const fraction = normalized.match(/^(-?\d+(?:\.\d+)?)\/(-?\d+(?:\.\d+)?)$/);
  if (fraction) {
    const numerator = Number(fraction[1]);
    const denominator = Number(fraction[2]);
    if (Number.isFinite(numerator) && Number.isFinite(denominator) && denominator !== 0) {
      return numerator / denominator;
    }
  }
  const numeric = Number(normalized);
  return Number.isFinite(numeric) ? numeric : null;
}

function evaluateQuadratic(a: number, b: number, c: number, x: number) {
  return a * x * x + b * x + c;
}

function scale(value: number, min: number, max: number, outputMin: number, outputMax: number) {
  if (max === min) {
    return (outputMin + outputMax) / 2;
  }
  return outputMin + ((value - min) / (max - min)) * (outputMax - outputMin);
}

function formatNumber(value: number) {
  if (Math.abs(value) < 0.0001) {
    return "0";
  }
  if (Number.isInteger(value)) {
    return String(value);
  }
  return value.toFixed(2).replace(/0+$/, "").replace(/\.$/, "");
}

function AnswerLog({lesson}: {lesson: Lesson}) {
  return (
    <div className="rounded border border-zinc-700/60 bg-black/28 p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.03),0_18px_50px_rgba(0,0,0,0.22)] backdrop-blur-md">
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
        <div className="mt-4 rounded border border-amber-500/40 bg-amber-950/25 p-4 text-sm text-amber-50">
          <p className="font-mono text-[11px] uppercase tracking-wide text-amber-300">Valid equation / unsupported lesson method</p>
          <p className="mt-2 leading-6">{lesson.unsupportedReason}</p>
          <p className="mt-3 text-amber-100/75">
            The short-term scope keeps the generation pipeline reliable for 30-90 second homework walkthroughs. Future support can add method-specific templates for square-root, completing-the-square, and quadratic-formula lessons without changing the artifact pipeline.
          </p>
        </div>
      ) : null}
    </div>
  );
}

function SolutionLinesLog({lines}: {lines: ReturnType<typeof flattenLessonMathLines>}) {
  return (
    <div className="mt-6 rounded border border-emerald-400/35 bg-emerald-950/10 p-4">
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

function RealWorldContextLog({
  artifact,
  context,
  disabled = false,
  loading = false,
  onRun
}: {
  artifact?: GenerationArtifact;
  context: RealWorldContext;
  disabled?: boolean;
  loading?: boolean;
  onRun?: () => void;
}) {
  const stageLoading = loading || artifact?.status === "running";
  return (
    <StageCard
      accent="cyan"
      action={onRun ? <IconButton disabled={disabled || stageLoading} label="Regenerate real_world_context" onClick={onRun}><RegenerateIcon /></IconButton> : null}
      artifact={artifact}
      loading={stageLoading}
      title="real_world_context"
    >
      {context.status === "completed" ? (
        <div className="mt-4 grid gap-3 rounded border border-cyan-400/20 bg-cyan-950/10 p-3">
          <div>
            <p className="font-mono text-[10px] uppercase tracking-wide text-cyan-200">Lesson story</p>
            <h4 className="mt-2 text-base font-semibold text-zinc-100">{context.title}</h4>
          </div>
          <p className="text-sm leading-6 text-zinc-300">{context.scenario}</p>
          <p className="rounded border border-zinc-800 bg-black/25 p-3 text-sm leading-6 text-cyan-100">{context.takeaway}</p>
        </div>
      ) : (
        <p className="mt-3 text-sm text-zinc-300">{context.unsupportedReason ?? "Real-world context is not available for this lesson."}</p>
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

function AvatarLog({
  actionDisabled = false,
  artifact,
  estimate,
  loading = false,
  onModelChange,
  onRun,
  selectedModel
}: {
  actionDisabled?: boolean;
  artifact: GenerationArtifact;
  estimate: HeyGenCostEstimate;
  loading?: boolean;
  onModelChange: (model: HeyGenAvatarModel) => void;
  onRun?: () => void;
  selectedModel: HeyGenAvatarModel;
}) {
  const stageLoading = loading || artifact.status === "running";
  const storageObjects = artifact.storageObjects ?? [];
  const outputFormat = typeof artifact.payload?.outputFormat === "string" ? artifact.payload.outputFormat : "webm";
  const artifactModel = readHeyGenAvatarModel(artifact) ?? selectedModel;
  const durationSeconds =
    typeof artifact.payload?.durationSeconds === "number"
      ? artifact.payload.durationSeconds
      : storageObjects.reduce((total, object) => total + (object.durationSeconds ?? 0), 0);
  return (
    <StageCard
      accent="pink"
      action={onRun ? <IconButton disabled={actionDisabled || stageLoading} label="Regenerate HeyGen avatar" onClick={onRun}><RegenerateIcon /></IconButton> : null}
      artifact={artifact}
      loading={stageLoading}
      title="heygen_avatar"
    >
      <AvatarModelSelector onChange={onModelChange} value={selectedModel} />
      {artifact.status === "completed" ? (
        <div className="mt-4 grid gap-3">
          <div className="grid gap-3 rounded border border-pink-400/20 bg-pink-950/10 p-3 text-sm sm:grid-cols-4">
            <div>
              <p className="font-mono text-xs uppercase tracking-wide text-zinc-500">Engine</p>
              <p className="mt-1 text-zinc-100">{heygenModelLabel(artifactModel)}</p>
            </div>
            <div>
              <p className="font-mono text-xs uppercase tracking-wide text-zinc-500">Format</p>
              <p className="mt-1 text-zinc-100">{outputFormat}</p>
            </div>
            <div>
              <p className="font-mono text-xs uppercase tracking-wide text-zinc-500">Duration</p>
              <p className="mt-1 text-zinc-100">{durationSeconds ? formatSeconds(durationSeconds) : "pending"}</p>
            </div>
            <div>
              <p className="font-mono text-xs uppercase tracking-wide text-zinc-500">Segments</p>
              <p className="mt-1 text-zinc-100">{storageObjects.length || "pending"}</p>
            </div>
          </div>
          {storageObjects.length > 0 ? (
            <ol className="grid gap-2">
              {storageObjects.map((storageObject, index) => (
                <li className="rounded border border-zinc-800 bg-zinc-950/45 p-3" key={storageObject.path}>
                  <div className="mb-2 flex items-center justify-between gap-3 text-sm">
                    <span className="font-mono text-xs uppercase tracking-wide text-zinc-500">
                      segment {index + 1}
                    </span>
                    <span className="font-mono text-xs text-pink-200">
                      {formatSeconds(storageObject.durationSeconds ?? estimate.averageSegmentSeconds)}
                    </span>
                  </div>
                  {storageObject.signedUrl ? (
                    <video className="aspect-video w-full rounded border border-zinc-800 bg-black" controls src={storageObject.signedUrl}>
                      <track kind="captions" />
                    </video>
                  ) : null}
                  <ArtifactStorage object={storageObject} />
                </li>
              ))}
            </ol>
          ) : null}
        </div>
      ) : (
        <p className="mt-3 text-sm text-zinc-300">{artifact.errorMessage ?? "Avatar video is not current."}</p>
      )}
    </StageCard>
  );
}

type HeyGenCostEstimate = {
  durationSeconds: number;
  averageSegmentSeconds: number;
  segmentCount: number;
  costUsd: number;
};

function estimateHeyGenCost(narration: LessonNarration | undefined, avatarModel: HeyGenAvatarModel): HeyGenCostEstimate {
  const segments = narration?.segments ?? [];
  const segmentDurations = segments.map((segment) => Math.max(0, segment.durationSeconds ?? 0));
  const durationSeconds =
    segmentDurations.reduce((total, duration) => total + duration, 0) ||
    Math.max(0, narration?.durationSeconds ?? 0);
  const segmentCount = segments.length || (durationSeconds > 0 ? 1 : 0);
  return {
    durationSeconds,
    averageSegmentSeconds: segmentCount > 0 ? durationSeconds / segmentCount : 0,
    segmentCount,
    costUsd: durationSeconds * heygenModelRate(avatarModel),
  };
}

function AvatarRunSummary({estimate, model}: {estimate: HeyGenCostEstimate; model: HeyGenAvatarModel}) {
  return (
    <div className="mt-4 rounded border border-pink-400/25 bg-pink-950/10 p-3 text-sm text-zinc-300">
      <p>
        Optional avatar pass. It will create {estimate.segmentCount || "the"} HeyGen clip
        {estimate.segmentCount === 1 ? "" : "s"} from the completed ElevenLabs audio and only makes the render stale.
      </p>
      <p className="mt-2 font-mono text-xs uppercase tracking-wide text-pink-200">
        estimate: {heygenModelLabel(model)} / {formatSeconds(estimate.durationSeconds)} / {formatCurrency(estimate.costUsd)}
      </p>
    </div>
  );
}

function AvatarModelSelector({
  onChange,
  value
}: {
  onChange: (model: HeyGenAvatarModel) => void;
  value: HeyGenAvatarModel;
}) {
  return (
    <div className="mt-4 rounded border border-pink-400/20 bg-pink-950/5 p-2">
      <div className="grid gap-2 sm:grid-cols-3">
        {HEYGEN_AVATAR_MODELS.map((model) => (
          <button
            className={`rounded border px-3 py-2 text-left transition ${
              value === model.id
                ? "border-pink-300/60 bg-pink-300/10 text-pink-100"
                : "border-zinc-800 bg-zinc-950/50 text-zinc-400 hover:border-zinc-700 hover:text-zinc-200"
            }`}
            key={model.id}
            onClick={() => onChange(model.id)}
            type="button"
          >
            <span className="block text-sm font-medium">{model.label}</span>
            <span className="mt-1 block font-mono text-[10px] uppercase tracking-wide">
              {formatCurrency(model.rate)}/sec · {model.note}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}

function AvatarRunConfirm({
  estimate,
  force,
  onCancel,
  onConfirm,
  selectedModel
}: {
  estimate: HeyGenCostEstimate;
  force: boolean;
  onCancel: () => void;
  onConfirm: () => void;
  selectedModel: HeyGenAvatarModel;
}) {
  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/55 px-4 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-md border border-pink-400/30 bg-[#080c12]/95 p-4 shadow-[0_24px_80px_rgba(0,0,0,0.75),0_0_48px_rgba(244,114,182,0.1)]">
        <div className="flex items-start gap-3">
          <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded border border-pink-400/35 bg-pink-400/10 font-mono text-sm text-pink-200">
            !
          </span>
          <div>
            <h3 className="font-mono text-sm uppercase tracking-wide text-pink-200">Run HeyGen avatar</h3>
            <p className="mt-2 text-sm leading-6 text-zinc-300">
              This will submit {estimate.segmentCount || "the"} narration segment
              {estimate.segmentCount === 1 ? "" : "s"} to HeyGen. Estimated cost is
              {" "}{formatCurrency(estimate.costUsd)} for {formatSeconds(estimate.durationSeconds)}.
            </p>
            <p className="mt-2 font-mono text-xs uppercase tracking-wide text-pink-200">
              engine: {heygenModelLabel(selectedModel)} / {formatCurrency(heygenModelRate(selectedModel))} per second
            </p>
            {force ? (
              <p className="mt-2 text-sm leading-6 text-amber-100">
                Regenerating replaces the current avatar artifact and marks the Motion Canvas render stale.
              </p>
            ) : null}
          </div>
        </div>
        <div className="mt-5 flex justify-end gap-2">
          <button
            className="rounded border border-zinc-800 px-3 py-2 text-sm text-zinc-300 transition hover:border-zinc-700 hover:text-zinc-100"
            onClick={onCancel}
            type="button"
          >
            Cancel
          </button>
          <button
            className="rounded border border-pink-300/55 bg-pink-400/10 px-3 py-2 text-sm text-pink-100 transition hover:bg-pink-400/20"
            onClick={onConfirm}
            type="button"
          >
            Run HeyGen
          </button>
        </div>
      </div>
    </div>
  );
}

function RenderRunConfirm({
  force,
  onCancel,
  onConfirm
}: {
  force: boolean;
  onCancel: () => void;
  onConfirm: (includeAvatar: boolean) => void;
}) {
  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/55 px-4 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-md border border-lime-400/30 bg-[#080c12]/95 p-4 shadow-[0_24px_80px_rgba(0,0,0,0.75),0_0_48px_rgba(132,204,22,0.1)]">
        <h3 className="font-mono text-sm uppercase tracking-wide text-lime-200">Render video solution</h3>
        <p className="mt-2 text-sm leading-6 text-zinc-300">
          Completed HeyGen clips are available. Choose whether Motion Canvas should overlay the avatar in this render.
        </p>
        {force ? (
          <p className="mt-2 text-sm leading-6 text-amber-100">
            Regenerating will replace the current rendered video artifact.
          </p>
        ) : null}
        <div className="mt-5 grid gap-2 sm:grid-cols-3">
          <button
            className="rounded border border-zinc-800 px-3 py-2 text-sm text-zinc-300 transition hover:border-zinc-700 hover:text-zinc-100"
            onClick={onCancel}
            type="button"
          >
            Cancel
          </button>
          <button
            className="rounded border border-zinc-700 bg-zinc-950/70 px-3 py-2 text-sm text-zinc-100 transition hover:border-zinc-500"
            onClick={() => onConfirm(false)}
            type="button"
          >
            No avatar
          </button>
          <button
            className="rounded border border-lime-300/55 bg-lime-400/10 px-3 py-2 text-sm text-lime-100 transition hover:bg-lime-400/20"
            onClick={() => onConfirm(true)}
            type="button"
          >
            Include avatar
          </button>
        </div>
      </div>
    </div>
  );
}

function RenderLog({
  actionDisabled = false,
  artifact,
  loading = false,
  narration,
  onOpenLesson,
  onRun,
  timeline
}: {
  actionDisabled?: boolean;
  artifact: GenerationArtifact;
  loading?: boolean;
  narration?: LessonNarration;
  onOpenLesson?: () => void;
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
      {timeline ? <RenderInputSummary narration={narration} renderArtifact={artifact} timeline={timeline} /> : null}
      {artifact.status === "completed" ? (
        <div className="mt-3 flex flex-col gap-3 rounded border border-lime-400/25 bg-lime-950/10 p-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-lime-100">Video is ready in the Lesson tab.</p>
          <button
            aria-label="Open Lesson tab"
            className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded border border-lime-400/30 text-lime-200 transition hover:border-lime-300/70 hover:bg-lime-300/10 hover:text-lime-100"
            onClick={onOpenLesson}
            title="Open Lesson tab"
            type="button"
          >
            <OpenLessonIcon />
          </button>
        </div>
      ) : (
        <p className="mt-3 text-sm text-zinc-300">{artifact.errorMessage ?? "Render artifact is not current."}</p>
      )}
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
  const avatarArtifactId =
    typeof renderArtifact?.payload?.avatarArtifactId === "string"
      ? renderArtifact.payload.avatarArtifactId
      : typeof renderArtifact?.configMetadata?.avatarArtifactId === "string"
        ? renderArtifact.configMetadata.avatarArtifactId
        : null;
  return (
    <div className="mt-4 rounded border border-lime-400/20 bg-lime-950/5 p-3">
      <p className="font-mono text-xs uppercase tracking-wide text-lime-200">render input</p>
      <p className="mt-2 max-w-2xl text-sm leading-6 text-zinc-300">
        Motion Canvas receives the lesson, resolved timeline, and signed narration segment URLs. The renderer uses those inputs to
        draw the blackboard scene, place captions, and mux narration into the final MP4.
      </p>
      <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-4">
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
        <div className="rounded border border-zinc-800 bg-zinc-950/45 p-3">
          <dt className="font-mono text-xs uppercase tracking-wide text-zinc-500">Avatar</dt>
          <dd className="mt-1 break-words text-zinc-100">{avatarArtifactId ? "included" : "none"}</dd>
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
    <div className={`mt-6 rounded border ${accentBorderClass(accent)} p-4`}>
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

type Accent = "amber" | "cyan" | "fuchsia" | "lime" | "pink" | "sky" | "violet" | "zinc";

function PendingLog({accent = "zinc", className = "", title}: {accent?: Accent; className?: string; title: string}) {
  return (
    <div className={`${className} rounded border ${accentBorderClass(accent)} p-4 backdrop-blur`}>
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
    <div className={`${className} rounded border ${accentBorderClass(accent)} p-4 backdrop-blur`}>
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

function readHeyGenAvatarModel(artifact: GenerationArtifact): HeyGenAvatarModel | null {
  const values = [
    artifact.payload?.avatarModel,
    artifact.configMetadata?.avatarModel,
    artifact.model
  ];
  const model = values.find((value): value is string => typeof value === "string");
  return isHeyGenAvatarModel(model) ? model : null;
}

function isHeyGenAvatarModel(value: string | undefined): value is HeyGenAvatarModel {
  return value === "avatar_iii" || value === "avatar_iv" || value === "avatar_v";
}

function heygenModelLabel(model: HeyGenAvatarModel) {
  return HEYGEN_AVATAR_MODELS.find((option) => option.id === model)?.label ?? model;
}

function heygenModelRate(model: HeyGenAvatarModel) {
  return HEYGEN_AVATAR_MODELS.find((option) => option.id === model)?.rate ?? 0;
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

function formatCurrency(value: number) {
  if (value > 0 && value < 0.01) {
    return `$${value.toFixed(4)}`;
  }
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(value);
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
  const triggerRef = useRef<HTMLSpanElement>(null);
  const [position, setPosition] = useState<{left: number; top: number} | null>(null);
  const details = stageDetails[title] ?? fallbackStageDetails;
  const open = position !== null;

  function openPanel() {
    const rect = triggerRef.current?.getBoundingClientRect();
    if (!rect) {
      return;
    }
    const width = Math.min(420, window.innerWidth - 24);
    const left = Math.max(12, Math.min(rect.left, window.innerWidth - width - 12));
    const preferredTop = rect.bottom + 8;
    const maxPanelHeight = Math.min(440, window.innerHeight - 24);
    const top =
      preferredTop + maxPanelHeight > window.innerHeight
        ? Math.max(12, rect.top - maxPanelHeight - 8)
        : preferredTop;
    setPosition({left, top});
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
          open
            ? "border-emerald-400/60 text-emerald-300"
            : "border-zinc-700 text-zinc-500"
        ].join(" ")}
        ref={triggerRef}
        tabIndex={0}
      >
        i
      </span>
      {position ? (
        <span
          className="pointer-events-none fixed z-[120] max-h-[min(440px,calc(100vh-24px))] w-[min(420px,calc(100vw-24px))] overflow-auto rounded border border-zinc-700 bg-[#090d14]/98 p-3 text-left text-xs leading-5 text-zinc-200 shadow-2xl shadow-black/70 backdrop-blur"
          style={{left: position.left, top: position.top}}
        >
          <span className="block break-words font-mono text-[11px] uppercase tracking-wide text-emerald-300">{title}</span>
          <span className="mt-2 block break-words text-zinc-200">{details.summary}</span>
          <span className="mt-3 grid gap-2">
            <StageInfoRow label="Inputs" value={details.inputs} />
            <StageInfoRow label="Guardrails" value={details.guardrails} />
            <StageInfoRow label="Cost" value={details.cost} />
            {details.prompt ? <StageInfoRow label="Prompt" value={details.prompt} /> : null}
          </span>
        </span>
      ) : null}
    </span>
  );
}

function StageInfoRow({label, value}: {label: string; value: string}) {
  return (
    <span className="grid gap-0.5 border-t border-zinc-800 pt-2">
      <span className="font-mono text-[10px] uppercase tracking-wide text-zinc-500">{label}</span>
      <span className="break-words text-zinc-300">{value}</span>
    </span>
  );
}

type StageDetails = {
  summary: string;
  inputs: string;
  guardrails: string;
  cost: string;
  prompt?: string;
};

const fallbackStageDetails: StageDetails = {
  summary: "One persisted artifact boundary in the generation pipeline.",
  inputs: "The previous current artifact for this generation.",
  guardrails: "Artifacts are hashed, cached, and stale-marked when upstream inputs change.",
  cost: "No provider cost is recorded unless the stage calls an external paid API."
};

const stageDetails: Record<string, StageDetails> = {
  answer: {
    summary: "Normalizes the equation and solves it before any generative model is involved.",
    inputs: "Raw equation text from the calculator input.",
    guardrails: "SymPy-backed deterministic parsing verifies this is a quadratic in x and computes exact coefficients and roots.",
    cost: "Free. No external provider call."
  },
  solution_lines: {
    summary: "Turns the solved quadratic into stable board-work lines.",
    inputs: "The completed solution artifact.",
    guardrails: "Line IDs are deterministic and become the references used by script, animation, and render stages.",
    cost: "Free. Local lesson builder only."
  },
  real_world_context: {
    summary: "Optional lesson enrichment that gives the graph a compact real-world story.",
    inputs: "The completed deterministic lesson, including coefficients, roots, and method.",
    guardrails: "The model can only explain the supplied math. It cannot change roots, coefficients, or the solved equation.",
    cost: "OpenAI token usage is logged for spend history but excluded from average video cost.",
    prompt: "Prompt source: apps/api/app/services/context/prompts/real_world_context.md"
  },
  teacher_script: {
    summary: "Writes concise teacher narration from the deterministic lesson.",
    inputs: "Lesson steps, math-line IDs, instructor ID, word budget, and output mode.",
    guardrails: "The model must reference existing teaching steps and math-line IDs; it cannot introduce new math.",
    cost: "OpenAI token usage is logged as input and output token events.",
    prompt: "Prompt source: apps/api/app/services/scripts/prompts/factoring_teacher_script.md"
  },
  elevenlabs_request: {
    summary: "Shapes script text into the exact per-step speech payload used for narration.",
    inputs: "Completed teacher script segments.",
    guardrails: "Speech text stays tied to script segment IDs so audio, captions, and avatar clips can be matched later.",
    cost: "Usually free unless the configured speech-markup provider uses an LLM.",
    prompt: "LLM provider path: apps/api/app/providers/openai/speech_markup_provider.py"
  },
  elevenlabs_audio: {
    summary: "Generates private per-step narration audio and alignment.",
    inputs: "ElevenLabs-ready speech text, selected instructor voice ID, and model ID.",
    guardrails: "Each MP3 is persisted with its scriptSegmentId and exposed to the app through signed URLs only.",
    cost: "ElevenLabs credits are logged from generated speech character count."
  },
  heygen_avatar: {
    summary: "Optional paid avatar pass. It creates one transparent avatar clip per narration segment.",
    inputs: "Completed ElevenLabs segment audio URLs and the selected instructor HeyGen avatar ID.",
    guardrails: "The stage is explicit and confirmed before running. Regenerating it only makes downstream render artifacts stale.",
    cost: `Estimate uses the selected engine rate: Avatar III ${formatCurrency(heygenModelRate("avatar_iii"))}/sec, Avatar IV ${formatCurrency(heygenModelRate("avatar_iv"))}/sec, Avatar V ${formatCurrency(heygenModelRate("avatar_v"))}/sec.`
  },
  animation_plan: {
    summary: "Chooses semantic blackboard actions for the lesson.",
    inputs: "Lesson structure, teacher script, and narration text.",
    guardrails: "The validator rejects actions that target unknown math-line IDs; the LLM does not emit Motion Canvas code.",
    cost: "OpenAI token usage is logged when the OpenAI planner is enabled.",
    prompt: "Prompt source: apps/api/app/services/animation/prompts/blackboard_animation_plan.md"
  },
  resolved_timeline: {
    summary: "Maps planned actions to concrete timestamps.",
    inputs: "Animation plan plus ElevenLabs character alignment.",
    guardrails: "Deterministic resolver code maps trigger phrases to timing windows for captions, chalk SFX, and board actions.",
    cost: "Free. Local resolver only."
  },
  motion_canvas_render: {
    summary: "Renders the final lesson video.",
    inputs: "Resolved timeline, signed narration audio, and optional HeyGen avatar clips.",
    guardrails: "The command adapter downloads media, renders frames headlessly, muxes audio, and overlays avatar clips with ffmpeg.",
    cost: "Free locally, aside from infrastructure runtime."
  }
};


function accentTextClass(accent: Accent) {
  return {
    amber: "text-amber-300",
    cyan: "text-cyan-300",
    fuchsia: "text-fuchsia-300",
    lime: "text-lime-300",
    pink: "text-pink-300",
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
    pink: "border-pink-400/35 bg-pink-950/10",
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

function OpenLessonIcon() {
  return (
    <svg aria-hidden="true" className="h-4 w-4" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" viewBox="0 0 24 24">
      <path d="M7 17 17 7" />
      <path d="M9 7h8v8" />
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
  return [
    "rounded-sm border px-4 py-2 font-medium transition",
    active
      ? "border-emerald-400/45 bg-emerald-400/10 text-emerald-200 shadow-[inset_0_0_18px_rgba(52,211,153,0.08)]"
      : "border-transparent text-zinc-400 hover:border-zinc-800 hover:text-zinc-100"
  ].join(" ");
}
