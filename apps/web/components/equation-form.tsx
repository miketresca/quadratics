"use client";

import {instructors} from "@quadratics/config";
import type {CurrentUser, Instructor, Lesson} from "@quadratics/types";
import {useEffect, useMemo, useRef, useState, useTransition} from "react";

import {LessonResult} from "@/components/lesson-result";
import {MathEquationInput} from "@/components/math-equation-input";
import {
  createInstructor,
  createGeneration,
  deleteInstructor,
  listInstructors,
  updateInstructor,
  runGenerationStage
} from "@/lib/api";
import {stateForLesson, type SolveViewState} from "@/lib/lesson-view";
import {createClient} from "@/lib/supabase/client";

const sampleEquations = ["x^2 + 5x + 6", "2x^2 - 7x + 3", "x^2 - x"];
const supabaseConfigured = Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

type InstructorProfile = {
  id: string;
  displayName: string;
  elevenLabsId: string;
  heygenId: string;
  referenceImage: string | null;
  imageZoom: number;
  imageX: number;
  imageY: number;
};

const defaultInstructorProfiles: InstructorProfile[] = instructors.map((instructor) => ({
  id: instructor.id,
  displayName: instructor.displayName,
  elevenLabsId: "voiceId" in instructor && typeof instructor.voiceId === "string" ? instructor.voiceId : "",
  heygenId: "avatarId" in instructor && typeof instructor.avatarId === "string" ? instructor.avatarId : "",
  referenceImage: null,
  imageZoom: 1,
  imageX: 50,
  imageY: 50
}));

export function EquationForm({initialUser: _initialUser}: {initialUser: CurrentUser | null}) {
  const [viewState, setViewState] = useState<SolveViewState>({kind: "idle"});
  const [equationValue, setEquationValue] = useState("");
  const [instructorProfiles, setInstructorProfiles] = useState<InstructorProfile[]>(defaultInstructorProfiles);
  const [selectedInstructorId, setSelectedInstructorId] = useState(defaultInstructorProfiles[0]?.id ?? "male");
  const [instructorEditorOpen, setInstructorEditorOpen] = useState(false);
  const [instructorDraft, setInstructorDraft] = useState<InstructorProfile>(defaultInstructorProfiles[0]);
  const [instructorStatus, setInstructorStatus] = useState<string | null>(null);
  const [instructorSaving, setInstructorSaving] = useState(false);
  const [activePipelineStage, setActivePipelineStage] = useState<string>();
  const [isPending, startTransition] = useTransition();
  const errorRef = useRef<HTMLParagraphElement>(null);
  const instructorEditorRef = useRef<HTMLDivElement>(null);
  const pipelineInFlightRef = useRef(false);
  const selectedInstructor = useMemo(
    () => instructorProfiles.find((profile) => profile.id === selectedInstructorId) ?? instructorProfiles[0],
    [instructorProfiles, selectedInstructorId]
  );
  const instructorDraftDirty =
    instructorDraft.displayName !== selectedInstructor?.displayName ||
    instructorDraft.elevenLabsId !== selectedInstructor?.elevenLabsId ||
    instructorDraft.heygenId !== selectedInstructor?.heygenId ||
    instructorDraft.referenceImage !== selectedInstructor?.referenceImage ||
    instructorDraft.imageZoom !== selectedInstructor?.imageZoom ||
    instructorDraft.imageX !== selectedInstructor?.imageX ||
    instructorDraft.imageY !== selectedInstructor?.imageY;

  useEffect(() => {
    void refreshInstructors();
  }, []);

  useEffect(() => {
    function closeInstructorEditor(event: PointerEvent) {
      const target = event.target;
      if (target instanceof Node && instructorEditorRef.current && !instructorEditorRef.current.contains(target)) {
        setInstructorEditorOpen(false);
      }
    }

    document.addEventListener("pointerdown", closeInstructorEditor);
    return () => document.removeEventListener("pointerdown", closeInstructorEditor);
  }, []);

  useEffect(() => {
    if (!instructorEditorOpen || !selectedInstructor) {
      return;
    }
    setInstructorDraft(selectedInstructor);
  }, [instructorEditorOpen, selectedInstructor]);

  function onSubmit(formData: FormData) {
    startTransition(async () => {
      const equation = String(formData.get("equation") ?? "");
      const instructorId = selectedInstructor?.id ?? String(formData.get("instructorId") ?? "male");
      setViewState({kind: "submitting"});
      if (process.env.NODE_ENV === "development") {
        console.info("[quadratics] submitting equation", {equation, instructorId});
      }

      try {
        if (!supabaseConfigured) {
          throw new Error("Sign in to run an equation.");
        }
        const supabase = createClient();
        const {
          data: {session}
        } = await supabase.auth.getSession();
        if (!session?.access_token) {
          throw new Error("Sign in to run an equation.");
        }
        const accessToken = session.access_token;
        const generation = await createGeneration({accessToken, equation, instructorId});
        const lesson = generation.lesson as Lesson;
        if (process.env.NODE_ENV === "development") {
          const lineCount = lesson.steps.reduce((count, step) => count + step.mathLines.length, 0);
          console.info("[quadratics] received lesson", {
            status: lesson.status,
            method: lesson.method,
            lineCount
          });
        }
        setViewState(stateForLesson(lesson, undefined, undefined, generation));
      } catch (error) {
        setViewState({kind: "error", message: error instanceof Error ? error.message : "Could not solve the equation"});
        setTimeout(() => errorRef.current?.focus(), 0);
      }
    });
  }

  function startPipelineOperation(stage: string) {
    if (pipelineInFlightRef.current || viewState.kind === "submitting") {
      return false;
    }
    pipelineInFlightRef.current = true;
    setActivePipelineStage(stage);
    return true;
  }

  function finishPipelineOperation() {
    pipelineInFlightRef.current = false;
    setActivePipelineStage(undefined);
  }

  function runScript() {
    if (!lesson || !startPipelineOperation("teacher_script")) {
      return;
    }

    startTransition(async () => {
      setViewState({kind: "submitting", lesson, generation, scriptLoading: true});
      try {
        if (!supabaseConfigured) {
          throw new Error("Sign in to generate the teacher script.");
        }
        const accessToken = await getAccessToken();
        if (!generation) {
          throw new Error("Solve the equation before generating the teacher script.");
        }
        const response = await runGenerationStage({
          accessToken,
          generationId: generation.job.id,
          stage: "teacher_script"
        });
        setViewState(stateForLesson(response.lesson as Lesson, undefined, undefined, response));
      } catch (scriptError) {
        if (process.env.NODE_ENV === "development") {
          console.error("[quadratics] script generation failed", scriptError);
        }
        setViewState(stateForLesson(lesson, script, narration, generation));
      } finally {
        finishPipelineOperation();
      }
    });
  }

  const disabled = isPending || viewState.kind === "submitting" || Boolean(activePipelineStage);
  const lesson =
    viewState.kind === "success" || viewState.kind === "unsupported" || viewState.kind === "submitting"
      ? viewState.lesson
      : null;
  const script =
    viewState.kind === "success" || viewState.kind === "unsupported" || viewState.kind === "submitting"
      ? viewState.script
      : undefined;
  const narration =
    viewState.kind === "success" || viewState.kind === "unsupported" || viewState.kind === "submitting"
      ? viewState.narration
      : undefined;
  const generation =
    viewState.kind === "success" || viewState.kind === "unsupported" || viewState.kind === "submitting"
      ? viewState.generation
      : undefined;
  const loadingStage = activePipelineStage ?? (viewState.kind === "submitting" ? viewState.loadingStage : undefined);
  const scriptLoading =
    viewState.kind === "submitting" &&
    (viewState.scriptLoading === true || loadingStage === "teacher_script");
  const speechMarkupLoading =
    viewState.kind === "submitting" &&
    (viewState.speechMarkupLoading === true || loadingStage === "elevenlabs_request" || loadingStage === "elevenlabs_audio");
  const narrationLoading =
    viewState.kind === "submitting" &&
    viewState.narrationLoading === true;

  async function refreshInstructors() {
    if (!supabaseConfigured) {
      return;
    }
    try {
      const accessToken = await getAccessToken();
      const nextProfiles = (await listInstructors(accessToken)).map(instructorToProfile);
      if (nextProfiles.length === 0) {
        return;
      }
      setInstructorProfiles(nextProfiles);
      setSelectedInstructorId((current) =>
        nextProfiles.some((profile) => profile.id === current) ? current : nextProfiles[0].id
      );
    } catch (error) {
      if (process.env.NODE_ENV === "development") {
        console.warn("[quadratics] could not load instructors", error);
      }
    }
  }

  function selectInstructor(profile: InstructorProfile) {
    setSelectedInstructorId(profile.id);
    setInstructorDraft(profile);
    setInstructorStatus(null);
  }

  async function saveInstructorDraft() {
    setInstructorSaving(true);
    setInstructorStatus(null);
    try {
      const accessToken = await getAccessToken();
      const saved = await updateInstructor({
        accessToken,
        instructorId: instructorDraft.id,
        displayName: instructorDraft.displayName,
        voiceId: instructorDraft.elevenLabsId,
        avatarId: instructorDraft.heygenId,
        referenceImageUrl: instructorDraft.referenceImage,
        imageZoom: instructorDraft.imageZoom,
        imageX: instructorDraft.imageX,
        imageY: instructorDraft.imageY
      });
      const savedProfile = instructorToProfile(saved);
      setInstructorProfiles((current) => current.map((profile) => (profile.id === savedProfile.id ? savedProfile : profile)));
      setInstructorDraft(savedProfile);
      setInstructorStatus("Saved");
    } catch (error) {
      setInstructorStatus(error instanceof Error ? error.message : "Could not save instructor");
    } finally {
      setInstructorSaving(false);
    }
  }

  async function createNewInstructor() {
    setInstructorSaving(true);
    setInstructorStatus(null);
    try {
      const accessToken = await getAccessToken();
      const created = await createInstructor({
        accessToken,
        displayName: "New Instructor",
        voiceId: "",
        avatarId: "",
        referenceImageUrl: null,
        imageZoom: 1,
        imageX: 50,
        imageY: 50
      });
      const createdProfile = instructorToProfile(created);
      setInstructorProfiles((current) => [...current, createdProfile]);
      setSelectedInstructorId(createdProfile.id);
      setInstructorDraft(createdProfile);
      setInstructorStatus("Created");
    } catch (error) {
      setInstructorStatus(error instanceof Error ? error.message : "Could not create instructor");
    } finally {
      setInstructorSaving(false);
    }
  }

  async function deleteSelectedInstructor() {
    if (!selectedInstructor || instructorProfiles.length <= 1) {
      return;
    }
    setInstructorSaving(true);
    setInstructorStatus(null);
    try {
      const accessToken = await getAccessToken();
      await deleteInstructor({accessToken, instructorId: selectedInstructor.id});
      const nextProfiles = instructorProfiles.filter((profile) => profile.id !== selectedInstructor.id);
      setInstructorProfiles(nextProfiles);
      setSelectedInstructorId(nextProfiles[0].id);
      setInstructorDraft(nextProfiles[0]);
      setInstructorStatus("Deleted");
    } catch (error) {
      setInstructorStatus(error instanceof Error ? error.message : "Could not delete instructor");
    } finally {
      setInstructorSaving(false);
    }
  }

  function updateInstructorDraft(update: Partial<InstructorProfile>) {
    setInstructorDraft((current) => ({...current, ...update}));
  }

  function updateReferenceImage(file: File | undefined) {
    if (!file) {
      return;
    }
    const reader = new FileReader();
    reader.addEventListener("load", () => {
      if (typeof reader.result === "string") {
        updateInstructorDraft({
          referenceImage: reader.result,
          imageZoom: 1,
          imageX: 50,
          imageY: 50
        });
      }
    });
    reader.readAsDataURL(file);
  }

  return (
    <div className="w-full">
      <div className="relative mx-auto w-full max-w-sm rounded-md border border-emerald-400/15 bg-[#080c12]/92 p-4 shadow-[0_0_70px_rgba(16,185,129,0.14),0_24px_80px_rgba(0,0,0,0.55)] backdrop-blur sm:max-w-3xl sm:p-5">
        <div className="pointer-events-none absolute inset-x-6 -bottom-8 h-20 bg-emerald-400/10 blur-3xl" aria-hidden="true" />
        <form action={onSubmit} className="grid gap-4">
          <div className="relative flex min-h-16 items-center rounded-md border border-zinc-700/90 bg-[#101621] shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]">
            <label className="sr-only" htmlFor="equation">
              Equation
            </label>
            <MathEquationInput
              disabled={disabled}
              value={equationValue}
              onEquationChange={(visibleValue) => setEquationValue(visibleValue)}
            />
            <button
              className="group/submit mr-2 flex h-11 w-11 items-center justify-center rounded-md border border-zinc-700 bg-zinc-900 text-zinc-200 transition enabled:hover:border-emerald-400 enabled:hover:bg-emerald-400/10 enabled:hover:text-emerald-300 disabled:opacity-50"
              disabled={disabled}
              aria-label={disabled ? "Solving" : "Solve equation"}
            >
              {disabled ? <LoadingDots /> : <EnterIcon />}
            </button>
          </div>

          <div className="flex flex-wrap items-center gap-2 font-mono text-xs text-zinc-500">
            <span className="mr-1 uppercase tracking-wide">try</span>
            {sampleEquations.map((sample) => (
              <button
                className="rounded-md border border-zinc-800 bg-zinc-950/40 px-3 py-2 text-left text-zinc-300 transition enabled:hover:border-emerald-400/70 enabled:hover:bg-emerald-400/10 enabled:hover:text-emerald-300"
                disabled={disabled}
                key={sample}
                onClick={() => setEquationValue(sample)}
                type="button"
              >
                {sample}
              </button>
            ))}
          </div>

          <div className="relative grid gap-3 rounded-md border border-zinc-800 bg-zinc-950/35 p-2 sm:grid-cols-[minmax(0,1fr)_minmax(17rem,0.85fr)]" ref={instructorEditorRef}>
            <input name="instructorId" type="hidden" value={selectedInstructor?.id ?? "male"} />
            <div className="relative">
              <span className="mb-2 block px-1 font-mono text-xs uppercase tracking-wide text-zinc-500">Instructor</span>
              <button
                className="flex min-h-12 w-full items-center justify-between gap-3 rounded border border-zinc-800 bg-[#0b1018]/90 px-3 text-left transition hover:border-emerald-400/50 hover:bg-emerald-400/5 disabled:opacity-50"
                disabled={disabled}
                onClick={() => setInstructorEditorOpen((open) => !open)}
                type="button"
              >
                <span className="flex min-w-0 items-center gap-3">
                  <InstructorAvatar profile={selectedInstructor} />
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-medium text-zinc-100">{selectedInstructor?.displayName}</span>
                    <span className="mt-1 flex items-center gap-2 font-mono text-[10px] uppercase tracking-wide text-zinc-500">
                      <ProviderStatus label="11L" ready={Boolean(selectedInstructor?.elevenLabsId)} />
                      <ProviderStatus label="HGN" ready={Boolean(selectedInstructor?.heygenId)} />
                    </span>
                  </span>
                </span>
                <ChevronIcon open={instructorEditorOpen} />
              </button>

              {instructorEditorOpen ? (
                <div className="absolute left-0 top-[4.9rem] z-50 w-full min-w-0 max-w-[calc(100vw-2rem)] rounded-md border border-emerald-400/20 bg-[#080c12]/95 p-3 shadow-[0_24px_70px_rgba(0,0,0,0.68),0_0_32px_rgba(16,185,129,0.12)] backdrop-blur sm:min-w-[20rem]">
                  <div className="mb-3 flex items-center justify-between gap-2">
                    <span className="font-mono text-[10px] uppercase tracking-wide text-zinc-500">Global instructors</span>
                    <button
                      className="rounded border border-emerald-400/35 bg-emerald-400/10 px-2.5 py-1.5 text-xs text-emerald-200 transition hover:bg-emerald-400/20 disabled:opacity-50"
                      disabled={instructorSaving}
                      onClick={() => void createNewInstructor()}
                      type="button"
                    >
                      New
                    </button>
                  </div>
                  <div className="grid gap-2">
                    {instructorProfiles.map((profile) => (
                      <button
                        className={`flex items-center gap-3 rounded border px-2.5 py-2 text-left transition ${
                          profile.id === selectedInstructorId
                            ? "border-emerald-400/45 bg-emerald-400/10 text-emerald-100"
                            : "border-zinc-800 bg-zinc-950/45 text-zinc-300 hover:border-zinc-700"
                        }`}
                        key={profile.id}
                        onClick={() => selectInstructor(profile)}
                        type="button"
                      >
                        <InstructorAvatar profile={profile} small />
                        <span className="min-w-0">
                          <span className="block truncate text-sm">{profile.displayName}</span>
                          <span className="mt-1 flex items-center gap-2 font-mono text-[10px] uppercase tracking-wide text-zinc-500">
                            <ProviderStatus label="11L" ready={Boolean(profile.elevenLabsId)} />
                            <ProviderStatus label="HGN" ready={Boolean(profile.heygenId)} />
                          </span>
                        </span>
                      </button>
                    ))}
                  </div>

                  <div className="mt-3 grid gap-3 border-t border-zinc-800 pt-3">
                    <div className="flex items-center gap-3">
                      <InstructorAvatar editable profile={instructorDraft} />
                      <label className="cursor-pointer rounded border border-zinc-800 bg-zinc-950/50 px-3 py-2 font-mono text-[11px] uppercase tracking-wide text-zinc-400 transition hover:border-emerald-400/60 hover:text-emerald-300">
                        Image
                        <input
                          accept="image/*"
                          className="sr-only"
                          onChange={(event) => updateReferenceImage(event.currentTarget.files?.[0])}
                          type="file"
                        />
                      </label>
                    </div>
                    <label className="grid gap-1.5">
                      <span className="font-mono text-[10px] uppercase tracking-wide text-zinc-500">Name</span>
                      <input
                        className="h-10 rounded border border-zinc-800 bg-black/30 px-3 text-sm text-zinc-100 outline-none transition focus:border-emerald-400/70"
                        onChange={(event) => updateInstructorDraft({displayName: event.currentTarget.value})}
                        value={instructorDraft.displayName}
                      />
                    </label>
                    <label className="grid gap-1.5">
                      <span className="font-mono text-[10px] uppercase tracking-wide text-zinc-500">ElevenLabs ID</span>
                      <input
                        className="h-10 rounded border border-zinc-800 bg-black/30 px-3 font-mono text-xs text-zinc-100 outline-none transition focus:border-emerald-400/70"
                        onChange={(event) => updateInstructorDraft({elevenLabsId: event.currentTarget.value})}
                        placeholder="voice id"
                        value={instructorDraft.elevenLabsId}
                      />
                    </label>
                    <label className="grid gap-1.5">
                      <span className="font-mono text-[10px] uppercase tracking-wide text-zinc-500">HeyGen ID</span>
                      <input
                        className="h-10 rounded border border-zinc-800 bg-black/30 px-3 font-mono text-xs text-zinc-100 outline-none transition focus:border-emerald-400/70"
                        onChange={(event) => updateInstructorDraft({heygenId: event.currentTarget.value})}
                        placeholder="avatar id"
                        value={instructorDraft.heygenId}
                      />
                    </label>
                    {instructorDraft.referenceImage ? (
                      <div className="grid gap-2">
                        <CropControl label="Zoom" max={1.8} min={1} onChange={(imageZoom) => updateInstructorDraft({imageZoom})} step={0.05} value={instructorDraft.imageZoom} />
                        <CropControl label="X" max={100} min={0} onChange={(imageX) => updateInstructorDraft({imageX})} step={1} value={instructorDraft.imageX} />
                        <CropControl label="Y" max={100} min={0} onChange={(imageY) => updateInstructorDraft({imageY})} step={1} value={instructorDraft.imageY} />
                      </div>
                    ) : null}
                    <div className="flex justify-end gap-2">
                      {instructorProfiles.length > 1 ? (
                        <button
                          className="mr-auto rounded border border-red-500/35 bg-red-500/10 px-3 py-2 text-sm text-red-200 transition hover:border-red-400/60 hover:bg-red-500/15 disabled:opacity-50"
                          disabled={instructorSaving}
                          onClick={() => void deleteSelectedInstructor()}
                          type="button"
                        >
                          Delete
                        </button>
                      ) : null}
                      <button className="rounded border border-zinc-800 px-3 py-2 text-sm text-zinc-400 transition hover:border-zinc-700 hover:text-zinc-100" onClick={() => setInstructorEditorOpen(false)} type="button">
                        Close
                      </button>
                      {instructorDraftDirty ? (
                        <button
                          className="rounded border border-emerald-400/50 bg-emerald-400/10 px-3 py-2 text-sm text-emerald-200 transition hover:bg-emerald-400/20 disabled:opacity-50"
                          disabled={instructorSaving}
                          onClick={() => void saveInstructorDraft()}
                          type="button"
                        >
                          {instructorSaving ? "Saving" : "Save"}
                        </button>
                      ) : null}
                    </div>
                    {instructorStatus ? (
                      <p className="font-mono text-[11px] uppercase tracking-wide text-zinc-500">{instructorStatus}</p>
                    ) : null}
                  </div>
                </div>
              ) : null}
            </div>

            <fieldset className="grid gap-2">
              <legend className="sr-only">Output mode</legend>
              <span className="px-1 font-mono text-xs uppercase tracking-wide text-zinc-500">Output</span>
              <span className="grid min-h-12 grid-cols-2 gap-1 rounded border border-zinc-800 bg-[#0b1018]/90 p-1 text-sm text-zinc-100">
                <label className="cursor-pointer">
                  <input className="peer sr-only" name="outputMode" type="radio" value="audio" defaultChecked />
                  <span className="flex h-full items-center justify-center border border-transparent bg-zinc-950/40 px-2 text-zinc-400 transition peer-checked:border-emerald-400/45 peer-checked:bg-emerald-400/10 peer-checked:text-emerald-200">
                    Audio only
                  </span>
                </label>
                <label className="group/avatar relative cursor-not-allowed overflow-visible">
                  <input className="peer sr-only" disabled name="outputMode" type="radio" value="video_audio" />
                  <span className="flex h-full items-center justify-center gap-1 border border-transparent bg-black/20 px-2 text-zinc-600 transition">
                    AI Avatar
                    <span className="inline-flex h-5 w-5 items-center justify-center text-zinc-500">
                      <InfoIcon />
                    </span>
                  </span>
                  <span
                    className="pointer-events-none absolute right-0 top-10 z-20 hidden w-72 rounded-md border border-zinc-700 bg-[#101621] p-3 text-left text-sm leading-6 text-zinc-200 shadow-2xl shadow-black/50 group-hover/avatar:block"
                    id="avatar-api-key-help"
                    role="tooltip"
                  >
                    For AI avatar generations, add your HeyGen API key from the account menu. Open your profile in the top right,
                    choose API keys, then paste the key from your HeyGen dashboard.
                  </span>
                </label>
              </span>
            </fieldset>
          </div>
        </form>
      </div>

      {viewState.kind === "submitting" && !lesson ? <LessonResult lesson={null} scriptLoading={scriptLoading} /> : null}
      {viewState.kind === "error" ? (
        <p
          className="mx-auto mt-4 max-w-3xl rounded border border-red-500/50 bg-red-950/40 p-3 text-sm text-red-100"
          ref={errorRef}
          role="alert"
          tabIndex={-1}
        >
          {viewState.message}
        </p>
      ) : null}
      {lesson ? (
        <LessonResult
          lesson={lesson}
          narration={narration}
          generation={generation}
          actionDisabled={disabled}
          narrationLoading={narrationLoading}
          loadingStage={loadingStage}
          onGenerateScript={runScript}
          onRunStage={(stage, options) => runStage(stage, options)}
          speechMarkupLoading={speechMarkupLoading}
          script={script}
          scriptLoading={scriptLoading}
        />
      ) : null}
    </div>
  );

  function runStage(stage: string, options: {force?: boolean} = {}) {
    if (!lesson || !generation || !startPipelineOperation(stage)) {
      return;
    }
    startTransition(async () => {
      setViewState({kind: "submitting", lesson, script, narration, generation, loadingStage: stage});
      try {
        const accessToken = await getAccessToken();
        const nextGeneration = await runGenerationStage({
          accessToken,
          generationId: generation.job.id,
          stage,
          force: options.force
        });
        setViewState(stateForLesson(nextGeneration.lesson as Lesson, undefined, undefined, nextGeneration));
      } catch (stageError) {
        if (process.env.NODE_ENV === "development") {
          console.error("[quadratics] stage failed", stage, stageError);
        }
        setViewState(stateForLesson(lesson, script, narration, generation));
      } finally {
        finishPipelineOperation();
      }
    });
  }
}

async function getAccessToken() {
  const supabase = createClient();
  const {
    data: {session}
  } = await supabase.auth.getSession();
  if (!session?.access_token) {
    throw new Error("Sign in to run an equation.");
  }
  return session.access_token;
}

function EnterIcon() {
  return (
    <svg aria-hidden="true" className="h-5 w-5" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" viewBox="0 0 24 24">
      <path d="M20 4v7a4 4 0 0 1-4 4H5" />
      <path d="m9 11-4 4 4 4" />
    </svg>
  );
}

function LoadingDots() {
  return (
    <span className="flex h-5 items-end gap-0.5" aria-label="Loading">
      <span className="h-1 w-1 animate-bounce rounded-full bg-emerald-300 [animation-delay:-0.2s]" />
      <span className="h-1 w-1 animate-bounce rounded-full bg-emerald-300 [animation-delay:-0.1s]" />
      <span className="h-1 w-1 animate-bounce rounded-full bg-emerald-300" />
    </span>
  );
}

function InstructorAvatar({
  editable = false,
  profile,
  small = false
}: {
  editable?: boolean;
  profile?: InstructorProfile;
  small?: boolean;
}) {
  const sizeClass = small ? "h-8 w-8 text-[10px]" : editable ? "h-16 w-16 text-sm" : "h-10 w-10 text-xs";
  const initials = initialsFor(profile?.displayName ?? "Instructor");

  return (
    <span
      className={`${sizeClass} relative inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full border border-emerald-400/25 bg-emerald-400/10 font-mono font-semibold uppercase text-emerald-200 shadow-[0_0_18px_rgba(16,185,129,0.14)]`}
    >
      {profile?.referenceImage ? (
        <img
          alt=""
          className="h-full w-full object-cover"
          src={profile.referenceImage}
          style={{
            objectPosition: `${profile.imageX}% ${profile.imageY}%`,
            transform: `scale(${profile.imageZoom})`
          }}
        />
      ) : (
        initials
      )}
    </span>
  );
}

function ProviderStatus({label, ready}: {label: string; ready: boolean}) {
  return (
    <span className={`inline-flex items-center gap-1 ${ready ? "text-emerald-300" : "text-red-300/80"}`}>
      <span aria-hidden="true" className="text-[11px] leading-none">
        {ready ? "+" : "x"}
      </span>
      <span>{label}</span>
    </span>
  );
}

function CropControl({
  label,
  max,
  min,
  onChange,
  step,
  value
}: {
  label: string;
  max: number;
  min: number;
  onChange: (value: number) => void;
  step: number;
  value: number;
}) {
  return (
    <label className="grid grid-cols-[3.5rem_1fr] items-center gap-2">
      <span className="font-mono text-[10px] uppercase tracking-wide text-zinc-500">{label}</span>
      <input
        className="accent-emerald-300"
        max={max}
        min={min}
        onChange={(event) => onChange(Number(event.currentTarget.value))}
        step={step}
        type="range"
        value={value}
      />
    </label>
  );
}

function ChevronIcon({open}: {open: boolean}) {
  return (
    <svg
      aria-hidden="true"
      className={`h-4 w-4 shrink-0 text-zinc-500 transition ${open ? "rotate-180" : ""}`}
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="1.8"
      viewBox="0 0 24 24"
    >
      <path d="m6 9 6 6 6-6" />
    </svg>
  );
}

function InfoIcon() {
  return (
    <svg aria-hidden="true" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24">
      <circle cx="12" cy="12" r="9" />
      <path d="M12 10.5v5" strokeLinecap="round" />
      <path d="M12 7.5h.01" strokeLinecap="round" />
    </svg>
  );
}

function initialsFor(value: string) {
  return value
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join("");
}

function instructorToProfile(instructor: Instructor): InstructorProfile {
  return {
    id: instructor.id,
    displayName: instructor.displayName,
    elevenLabsId: instructor.voiceId ?? "",
    heygenId: instructor.avatarId ?? "",
    referenceImage: instructor.referenceImageUrl ?? null,
    imageZoom: instructor.imageZoom ?? 1,
    imageX: instructor.imageX ?? 50,
    imageY: instructor.imageY ?? 50
  };
}
