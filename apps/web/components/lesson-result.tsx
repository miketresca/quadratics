"use client";

import type {Lesson, LessonNarration, LessonScript, NarrationSegment} from "@quadratics/types";
import {useState} from "react";

import {flattenLessonMathLines} from "@/lib/lesson-view";

export function LessonResult({
  actionDisabled = false,
  lesson,
  narration,
  narrationLoading = false,
  onGenerateNarration,
  onGenerateScript,
  onRetryNarration,
  onRetryNarrationSegment,
  onRunFullPipeline,
  speechMarkupLoading = false,
  script,
  scriptLoading = false
}: {
  actionDisabled?: boolean;
  lesson: Lesson | null;
  narration?: LessonNarration;
  narrationLoading?: boolean;
  onGenerateNarration?: () => void;
  onGenerateScript?: () => void;
  onRetryNarration?: () => void;
  onRetryNarrationSegment?: (scriptSegmentId: string) => void;
  onRunFullPipeline?: () => void;
  speechMarkupLoading?: boolean;
  script?: LessonScript;
  scriptLoading?: boolean;
}) {
  const [activeView, setActiveView] = useState<"lesson" | "logs">("logs");
  const solutionLines = lesson ? flattenLessonMathLines(lesson) : [];

  return (
    <section className="mx-auto mt-6 max-w-3xl" aria-live="polite">
      <div className="mb-4 flex flex-col items-center justify-center gap-3 sm:flex-row">
        <div className="grid w-64 grid-cols-2 rounded-full border border-zinc-800 bg-zinc-950/70 p-1 text-sm shadow-xl shadow-black/30">
          <button
            className={viewButtonClass(activeView === "lesson")}
            onClick={() => setActiveView("lesson")}
            type="button"
          >
            Lesson
          </button>
          <button
            className={viewButtonClass(activeView === "logs")}
            onClick={() => setActiveView("logs")}
            type="button"
          >
            Logs
          </button>
        </div>
        {lesson && onRunFullPipeline ? (
          <button
            aria-label="Run full pipeline"
            className="flex h-10 items-center gap-2 rounded-md border border-emerald-400/35 bg-zinc-950/70 px-3 text-sm font-medium text-emerald-200 shadow-xl shadow-black/30 transition hover:bg-emerald-400/10"
            disabled={actionDisabled}
            onClick={onRunFullPipeline}
            type="button"
          >
            <RunIcon />
            Run A to Z
          </button>
        ) : null}
      </div>

      {activeView === "lesson" ? (
        <div className="min-h-64 rounded border border-zinc-800 bg-zinc-950/25" aria-label="Lesson preview" />
      ) : (
        <>
          {lesson ? <AnswerLog lesson={lesson} /> : <PendingLog title="answer" />}

          {solutionLines.length > 0 ? (
            <div className="mt-6 rounded border border-emerald-400/35 bg-emerald-950/10 p-4">
              <h3 className="font-mono text-sm uppercase tracking-wide text-emerald-300">solution_lines</h3>
              <ol className="mt-4 grid gap-2 font-mono text-sm text-zinc-100">
                {solutionLines.map((line, index) => (
                  <li className="flex gap-3" key={`${line.id}-${index}`}>
                    <span className="select-none text-zinc-500">{index + 1}</span>
                    <span>{line.expression}</span>
                  </li>
                ))}
              </ol>
            </div>
          ) : lesson ? null : (
            <PendingLog className="mt-6" title="solution_lines" />
          )}

          {script ? (
            <ScriptLog script={script} />
          ) : scriptLoading ? (
            <PendingLog accent="sky" className="mt-6" title="teacher_script" />
          ) : lesson ? (
            <RunnableLog
              accent="sky"
              className="mt-6"
              disabled={actionDisabled || !onGenerateScript}
              onRun={onGenerateScript}
              title="teacher_script"
            />
          ) : null}

          {narration?.speechText ? (
            <SpeechMarkupLog narration={narration} />
          ) : speechMarkupLoading ? (
            <PendingLog accent="amber" className="mt-6" title="elevenlabs_request" />
          ) : script?.status === "completed" ? (
            <RunnableLog
              accent="amber"
              className="mt-6"
              disabled={actionDisabled || !onGenerateNarration}
              onRun={onGenerateNarration}
              title="elevenlabs_request"
            />
          ) : null}

          {narration ? (
            <NarrationLog
              narration={narration}
              actionDisabled={actionDisabled}
              onRetry={onRetryNarration}
              onRetrySegment={onRetryNarrationSegment}
            />
          ) : narrationLoading ? (
            <PendingLog accent="fuchsia" className="mt-6" title="elevenlabs_audio" />
          ) : null}
        </>
      )}
    </section>
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
            a={lesson.coefficients.a.expression}, b={lesson.coefficients.b.expression}, c=
            {lesson.coefficients.c.expression}
          </dd>
        </div>
        <div>
          <dt className="text-xs uppercase tracking-wide text-zinc-500">Roots</dt>
          <dd className="font-mono text-emerald-300">
            {lesson.solutions.map((solution) => solution.expression).join(", ")}
          </dd>
        </div>
      </dl>
      {lesson.unsupportedReason ? (
        <p className="mt-4 rounded border border-amber-500/50 bg-amber-950/40 p-3 text-sm text-amber-100">
          {lesson.unsupportedReason}
        </p>
      ) : null}
    </div>
  );
}

function ScriptLog({script}: {script: LessonScript}) {
  return (
    <div className="mt-6 rounded border border-sky-400/35 bg-sky-950/10 p-4">
      <div className="flex items-start justify-between gap-4">
        <h3 className="font-mono text-sm uppercase tracking-wide text-sky-300">teacher_script</h3>
        <span className="font-mono text-xs text-zinc-500">
          {script.status}
          {script.status === "completed" ? ` / ${script.totalEstimatedSeconds}s` : ""}
        </span>
      </div>
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
              <p className="mt-3 break-words font-mono text-xs text-zinc-500">
                lines: {segment.mathLineIds.join(", ")}
              </p>
            </li>
          ))}
        </ol>
      ) : (
        <p className="mt-3 text-sm text-zinc-300">
          {script.unsupportedReason ?? "Script generation is not available for this lesson."}
        </p>
      )}
    </div>
  );
}

function SpeechMarkupLog({narration}: {narration: LessonNarration}) {
  const segments = narration.segments ?? [];
  return (
    <div className="mt-6 rounded border border-amber-400/35 bg-amber-950/10 p-4">
      <div className="flex items-start justify-between gap-4">
        <h3 className="font-mono text-sm uppercase tracking-wide text-amber-300">elevenlabs_request</h3>
        <span className="font-mono text-xs text-zinc-500">
          {segments.length > 0 ? `${segments.length} segment${segments.length === 1 ? "" : "s"}` : "prepared"}
        </span>
      </div>
      {segments.length > 0 ? (
        <>
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
          {narration.status !== "completed" && narration.speechText ? (
            <pre className="mt-3 max-h-40 overflow-auto whitespace-pre-wrap break-words rounded border border-amber-400/25 bg-zinc-950/70 p-3 font-mono text-xs leading-5 text-amber-100">
              {narration.speechText}
            </pre>
          ) : null}
        </>
      ) : (
        <pre className="mt-3 max-h-56 overflow-auto whitespace-pre-wrap break-words rounded border border-zinc-800 bg-zinc-950/70 p-3 font-mono text-xs leading-5 text-zinc-300">
          {narration.speechText}
        </pre>
      )}
    </div>
  );
}

function NarrationLog({
  actionDisabled = false,
  narration,
  onRetry,
  onRetrySegment
}: {
  actionDisabled?: boolean;
  narration: LessonNarration;
  onRetry?: () => void;
  onRetrySegment?: (scriptSegmentId: string) => void;
}) {
  const segments = narration.segments ?? [];
  return (
    <div className="mt-6 rounded border border-fuchsia-400/35 bg-fuchsia-950/10 p-4">
      <div className="flex items-start justify-between gap-4">
        <h3 className="font-mono text-sm uppercase tracking-wide text-fuchsia-300">elevenlabs_audio</h3>
        <div className="flex items-center gap-2">
          <span className="font-mono text-xs text-zinc-500">
            {narration.status}
            {narration.durationSeconds ? ` / ${Math.round(narration.durationSeconds)}s` : ""}
          </span>
          {onRetry ? (
            <button
              aria-label="Regenerate ElevenLabs audio"
              className="flex h-8 w-8 items-center justify-center rounded border border-fuchsia-400/35 text-fuchsia-200 transition hover:bg-fuchsia-400/10"
              disabled={actionDisabled}
              onClick={onRetry}
              title="Regenerate ElevenLabs audio"
              type="button"
            >
              <RegenerateIcon />
            </button>
          ) : null}
        </div>
      </div>
      {segments.length > 0 ? (
        <ol className="mt-4 grid gap-3">
          {segments.map((segment, index) => (
            <NarrationSegmentLog
              index={index}
              key={segment.scriptSegmentId}
              actionDisabled={actionDisabled}
              onRetry={onRetrySegment}
              segment={segment}
            />
          ))}
        </ol>
      ) : narration.status === "completed" && narration.audioBase64 ? (
        <div className="mt-4 grid gap-3">
          <audio className="w-full" controls src={`data:${narration.audioMimeType ?? "audio/mpeg"};base64,${narration.audioBase64}`}>
            <track kind="captions" />
          </audio>
          <p className="break-words font-mono text-xs text-zinc-500">
            voice: {narration.voiceId ?? "unknown"} / timing chars:{" "}
            {narration.normalizedAlignment?.characters.length ?? narration.alignment?.characters.length ?? 0}
          </p>
        </div>
      ) : (
        <p className="mt-3 text-sm text-zinc-300">
          {narration.unsupportedReason ?? "Audio generation is not available for this script."}
        </p>
      )}
      {segments.length > 0 && narration.unsupportedReason ? (
        <p className="mt-3 rounded border border-amber-400/40 bg-amber-950/20 p-3 text-sm text-amber-100">
          {narration.unsupportedReason}
        </p>
      ) : null}
    </div>
  );
}

function NarrationSegmentLog({
  actionDisabled = false,
  index,
  onRetry,
  segment
}: {
  actionDisabled?: boolean;
  index: number;
  onRetry?: (scriptSegmentId: string) => void;
  segment: NarrationSegment;
}) {
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
        {onRetry ? (
          <button
            aria-label={`Regenerate ElevenLabs audio for ${segment.title}`}
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded border border-fuchsia-400/35 text-fuchsia-200 transition hover:bg-fuchsia-400/10"
            disabled={actionDisabled}
            onClick={() => onRetry(segment.scriptSegmentId)}
            title={`Regenerate ${segment.title}`}
            type="button"
          >
            <RegenerateIcon />
          </button>
        ) : null}
      </div>
      <audio
        className="mt-3 w-full"
        controls
        src={`data:${segment.audioMimeType};base64,${segment.audioBase64}`}
      >
        <track kind="captions" />
      </audio>
    </li>
  );
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

function PendingLog({
  accent = "zinc",
  className = "",
  title
}: {
  accent?: "amber" | "fuchsia" | "sky" | "zinc";
  className?: string;
  title: string;
}) {
  const titleColor =
    accent === "sky"
      ? "text-sky-300"
      : accent === "fuchsia"
        ? "text-fuchsia-300"
        : accent === "amber"
          ? "text-amber-300"
          : "text-zinc-100";
  const borderColor =
    accent === "sky"
      ? "border-sky-400/35 bg-sky-950/10"
      : accent === "fuchsia"
        ? "border-fuchsia-400/35 bg-fuchsia-950/10"
        : accent === "amber"
          ? "border-amber-400/35 bg-amber-950/10"
          : "border-zinc-700/80 bg-zinc-950/55";

  return (
    <div className={`${className} rounded border ${borderColor} p-4 backdrop-blur`}>
      <div className="flex items-center justify-between gap-4">
        <h3 className={`font-mono text-sm uppercase tracking-wide ${titleColor}`}>{title}</h3>
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
  accent?: "amber" | "fuchsia" | "sky" | "zinc";
  className?: string;
  disabled?: boolean;
  onRun?: () => void;
  title: string;
}) {
  const titleColor =
    accent === "sky"
      ? "text-sky-300"
      : accent === "fuchsia"
        ? "text-fuchsia-300"
        : accent === "amber"
          ? "text-amber-300"
          : "text-zinc-100";
  const borderColor =
    accent === "sky"
      ? "border-sky-400/35 bg-sky-950/10"
      : accent === "fuchsia"
        ? "border-fuchsia-400/35 bg-fuchsia-950/10"
        : accent === "amber"
          ? "border-amber-400/35 bg-amber-950/10"
          : "border-zinc-700/80 bg-zinc-950/55";
  const buttonColor =
    accent === "sky"
      ? "border-sky-400/35 text-sky-200 hover:bg-sky-400/10"
      : accent === "amber"
        ? "border-amber-400/35 text-amber-200 hover:bg-amber-400/10"
        : accent === "fuchsia"
          ? "border-fuchsia-400/35 text-fuchsia-200 hover:bg-fuchsia-400/10"
          : "border-zinc-700 text-zinc-200 hover:bg-zinc-800/80";

  return (
    <div className={`${className} rounded border ${borderColor} p-4 backdrop-blur`}>
      <div className="flex items-center justify-between gap-4">
        <h3 className={`font-mono text-sm uppercase tracking-wide ${titleColor}`}>{title}</h3>
        <button
          aria-label={`Run ${title}`}
          className={`flex h-8 w-8 items-center justify-center rounded border transition disabled:opacity-40 ${buttonColor}`}
          disabled={disabled}
          onClick={onRun}
          title={`Run ${title}`}
          type="button"
        >
          <RunIcon />
        </button>
      </div>
    </div>
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
  return (
    <span
      aria-label="Loading"
      className="h-4 w-4 animate-spin rounded-full border border-zinc-700 border-t-emerald-300"
      role="status"
    />
  );
}

function viewButtonClass(active: boolean) {
  return [
    "rounded-full px-4 py-2 font-medium transition",
    active ? "bg-zinc-800/80 text-emerald-300" : "text-zinc-400 hover:text-zinc-100"
  ].join(" ");
}
