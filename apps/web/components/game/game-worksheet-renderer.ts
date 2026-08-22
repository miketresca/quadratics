import type {GameLessonId} from "@quadratics/types";
import type {Texture} from "three";

import type {GameWorksheetRunSnapshot} from "@/lib/api";

import {artifactForStage} from "./game-pipeline-utils";
import type {WorksheetPlaybackState} from "./game-runtime-storage";
import {
  GAME_LESSON_TEMPLATE_ID,
  LESSON_CHOICES,
  WORKSHEET_CANVAS_HEIGHT,
  WORKSHEET_CANVAS_WIDTH,
  WORKSHEET_COMPLETE_RECT,
  WORKSHEET_NEXT_PAGE_RECT
} from "./game-scene-config";
import type {
  InteractiveWorksheetBundle,
  WorksheetFillTarget,
  WorksheetHandwritingAction,
  WorksheetNarrationSection,
  WorksheetRect,
  WorksheetSection
} from "./game-types";

export function createWorksheetTexture(
  THREE: typeof import("three"),
  checkedLessonId: GameLessonId | null,
  hoveredChoiceId: GameLessonId | null,
  run: GameWorksheetRunSnapshot | null,
  playback: WorksheetPlaybackState
) {
  const canvas = document.createElement("canvas");
  canvas.width = WORKSHEET_CANVAS_WIDTH;
  canvas.height = WORKSHEET_CANVAS_HEIGHT;
  drawWorksheet(canvas, checkedLessonId, hoveredChoiceId, run, playback);
  const texture = new THREE.CanvasTexture(canvas);
  texture.anisotropy = 8;
  texture.needsUpdate = true;
  return texture;
}

export function refreshPaperTexture(
  texture: Texture | null,
  checkedLessonId: GameLessonId | null,
  hoveredChoiceId: GameLessonId | null,
  run: GameWorksheetRunSnapshot | null,
  playback: WorksheetPlaybackState
) {
  if (!texture?.image || !(texture.image instanceof HTMLCanvasElement)) {
    return;
  }
  drawWorksheet(texture.image, checkedLessonId, hoveredChoiceId, run, playback);
  texture.needsUpdate = true;
}

function drawWorksheet(
  canvas: HTMLCanvasElement,
  checkedLessonId: GameLessonId | null,
  hoveredChoiceId: GameLessonId | null,
  run: GameWorksheetRunSnapshot | null,
  playback: WorksheetPlaybackState
) {
  const context = canvas.getContext("2d");
  if (!context) {
    return;
  }
  context.clearRect(0, 0, canvas.width, canvas.height);
  context.fillStyle = "#fffaf0";
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.strokeStyle = "#ded2bd";
  context.lineWidth = 5;
  context.strokeRect(34, 34, canvas.width - 68, canvas.height - 68);

  if (checkedLessonId === GAME_LESSON_TEMPLATE_ID && run?.templateId === GAME_LESSON_TEMPLATE_ID) {
    drawGeneratedWorksheet(context, run, playback);
    return;
  }

  context.fillStyle = "#24313f";
  context.font = "700 58px ui-rounded, system-ui, sans-serif";
  context.fillText("Today’s worksheet", 116, 190);
  context.font = "34px ui-rounded, system-ui, sans-serif";
  context.fillStyle = "#64748b";
  context.fillText("Choose a lesson to begin.", 116, 250);

  for (const choice of LESSON_CHOICES) {
    const active = choice.id === checkedLessonId;
    const hovered = choice.id === hoveredChoiceId;
    context.fillStyle = active ? "#e7f8ef" : hovered ? "#f4f0e7" : "#fffdf8";
    context.strokeStyle = choice.locked ? "#d6c7ae" : active ? "#2f9d65" : hovered ? "#7c5f35" : "#cdbfAA";
    context.lineWidth = hovered || active ? 8 : 4;
    roundRect(context, choice.box.x, choice.box.y, choice.box.width, choice.box.height, 24);
    context.fill();
    context.stroke();

    const checkboxX = choice.box.x + 42;
    const checkboxY = choice.box.y + 48;
    context.strokeStyle = choice.locked ? "#a9987f" : "#314155";
    context.lineWidth = 7;
    roundRect(context, checkboxX, checkboxY, 72, 72, 10);
    context.stroke();
    if (active) {
      context.strokeStyle = "#15803d";
      context.lineWidth = 13;
      context.beginPath();
      context.moveTo(checkboxX + 15, checkboxY + 38);
      context.lineTo(checkboxX + 33, checkboxY + 57);
      context.lineTo(checkboxX + 60, checkboxY + 17);
      context.stroke();
    }

    context.fillStyle = choice.locked ? "#8b8173" : "#1f2937";
    context.font = "700 42px ui-rounded, system-ui, sans-serif";
    context.fillText(choice.title, choice.box.x + 146, choice.box.y + 70);
    context.fillStyle = choice.locked ? "#a69b89" : "#64748b";
    context.font = "30px ui-rounded, system-ui, sans-serif";
    context.fillText(choice.subtitle, choice.box.x + 146, choice.box.y + 122);
  }

  context.strokeStyle = "#e7dac4";
  context.lineWidth = 3;
  for (let index = 0; index < 8; index += 1) {
    const y = 940 + index * 58;
    context.beginPath();
    context.moveTo(118, y);
    context.lineTo(1082, y);
    context.stroke();
  }

  context.fillStyle = "#9a8973";
  context.font = "28px ui-rounded, system-ui, sans-serif";
  context.fillText("Notes", 118, 892);
}

function drawGeneratedWorksheet(context: CanvasRenderingContext2D, run: GameWorksheetRunSnapshot, playback: WorksheetPlaybackState) {
  const pages = worksheetPagesForRun(run);
  const currentPageId = currentWorksheetPageId(run, playback);
  const currentPageIndex = Math.max(0, pages.findIndex((page) => page.id === currentPageId));
  const sections = pageSectionsForRun(run, currentPageId);
  const fillTargets = worksheetFillTargetsForRun(run);
  const complete = artifactForStage(run, "interactive_bundle")?.status === "completed";
  const completedSections = new Set(playback.completedSectionIds);
  const pageComplete = isWorksheetPageComplete(run, playback, currentPageId);
  const nextPageId = nextWorksheetPageId(run, currentPageId);
  const allSectionsComplete = areAllWorksheetSectionsComplete(run, playback);

  context.fillStyle = "#24313f";
  context.font = "800 50px ui-rounded, system-ui, sans-serif";
  context.fillText("Volume With Whole-Number Cubes", 96, 150);
  context.font = "28px ui-rounded, system-ui, sans-serif";
  context.fillStyle = "#64748b";
  context.fillText(
    complete ? `Page ${currentPageIndex + 1} of ${pages.length} · click a section to reveal it` : "Build the worksheet pipeline on the laptop",
    96,
    205
  );

  const status = artifactForStage(run, "interactive_bundle")?.status ?? "waiting";
  context.fillStyle = complete ? "#d9f99d" : "#fef3c7";
  context.strokeStyle = complete ? "#15803d" : "#a16207";
  context.lineWidth = 3;
  roundRect(context, 780, 102, 318, 64, 18);
  context.fill();
  context.stroke();
  context.fillStyle = complete ? "#14532d" : "#713f12";
  context.font = "800 22px ui-monospace, SFMono-Regular, Menlo, monospace";
  context.fillText(`bundle: ${status}`, 810, 143);

  const sectionRects = sectionDisplayRects(sections);
  for (const section of sections) {
    const rect = sectionRects.get(section.id);
    if (!rect) {
      continue;
    }
    const active = playback.activeSectionId === section.id;
    const completed = completedSections.has(section.id);
    context.fillStyle = active ? "#eefcf4" : completed ? "#f7fff9" : "#fffdf8";
    context.strokeStyle = active ? "#0f9f6e" : completed ? "#2f9d65" : complete ? "#8fb99d" : "#cdbfaa";
    context.lineWidth = 4;
    roundRect(context, rect.x, rect.y, rect.width, rect.height, 22);
    context.fill();
    context.stroke();
    context.fillStyle = "#1f2937";
    context.font = "800 34px ui-rounded, system-ui, sans-serif";
    context.fillText(section.title, rect.x + 30, rect.y + 55);
    if (completed) {
      context.strokeStyle = "#15803d";
      context.lineWidth = 8;
      context.beginPath();
      context.moveTo(rect.x + rect.width - 72, rect.y + 50);
      context.lineTo(rect.x + rect.width - 48, rect.y + 76);
      context.lineTo(rect.x + rect.width - 20, rect.y + 30);
      context.stroke();
    }
    if (section.summary) {
      context.font = "24px ui-rounded, system-ui, sans-serif";
      context.fillStyle = "#64748b";
      wrapWorksheetText(context, section.summary, rect.x + 30, rect.y + 92, rect.width - 60, 30, 2);
    }
  }

  context.fillStyle = "#1f2937";
  context.font = "800 30px ui-rounded, system-ui, sans-serif";
  context.fillText(currentPageId === "page_2" ? "Guided-practice answers" : "Section notes", 96, 650);
  context.strokeStyle = "#e7dac4";
  context.lineWidth = 3;
  let rowY = 710;
  const pageTargets = fillTargets.filter((target) => (target.pageId ?? "page_1") === currentPageId);
  for (const target of pageTargets) {
    const revealedText = worksheetTargetRevealText(run, playback, target);
    context.beginPath();
    context.moveTo(110, rowY + 30);
    context.lineTo(1090, rowY + 30);
    context.stroke();
    context.fillStyle = revealedText ? "#1e3a8a" : "#9a8973";
    context.font = revealedText ? "30px Chalkboard SE, Comic Sans MS, ui-rounded, system-ui, sans-serif" : "26px ui-rounded, system-ui, sans-serif";
    context.fillText(revealedText || (complete ? "click a section to reveal" : "waiting for interactive bundle"), 120, rowY);
    rowY += 72;
  }

  if (complete && pageComplete && nextPageId) {
    context.fillStyle = "#e7f8ef";
    context.strokeStyle = "#15803d";
    context.lineWidth = 4;
    roundRect(context, WORKSHEET_NEXT_PAGE_RECT.x, WORKSHEET_NEXT_PAGE_RECT.y, WORKSHEET_NEXT_PAGE_RECT.width, WORKSHEET_NEXT_PAGE_RECT.height, 18);
    context.fill();
    context.stroke();
    context.fillStyle = "#14532d";
    context.font = "900 25px ui-monospace, SFMono-Regular, Menlo, monospace";
    context.fillText("NEXT PAGE  →", WORKSHEET_NEXT_PAGE_RECT.x + 42, WORKSHEET_NEXT_PAGE_RECT.y + 47);
  } else if (complete && allSectionsComplete) {
    context.fillStyle = playback.lessonCompletedAt ? "#dcfce7" : "#fff7ed";
    context.strokeStyle = playback.lessonCompletedAt ? "#16a34a" : "#ea580c";
    context.lineWidth = 4;
    roundRect(
      context,
      WORKSHEET_COMPLETE_RECT.x,
      WORKSHEET_COMPLETE_RECT.y,
      WORKSHEET_COMPLETE_RECT.width,
      WORKSHEET_COMPLETE_RECT.height,
      18
    );
    context.fill();
    context.stroke();
    context.fillStyle = playback.lessonCompletedAt ? "#14532d" : "#7c2d12";
    context.font = "900 23px ui-monospace, SFMono-Regular, Menlo, monospace";
    context.fillText(playback.lessonCompletedAt ? "LESSON COMPLETE" : "COMPLETE LESSON", WORKSHEET_COMPLETE_RECT.x + 34, WORKSHEET_COMPLETE_RECT.y + 46);
  }

  context.fillStyle = "#9a8973";
  context.font = "24px ui-rounded, system-ui, sans-serif";
  context.fillText(
    playback.lessonCompletedAt ? "Progress saved. Reset will return this worksheet to page 1." : "Progress is saved locally for this lesson run.",
    96,
    1455
  );
}

function roundRect(context: CanvasRenderingContext2D, x: number, y: number, width: number, height: number, radius: number) {
  context.beginPath();
  context.moveTo(x + radius, y);
  context.lineTo(x + width - radius, y);
  context.quadraticCurveTo(x + width, y, x + width, y + radius);
  context.lineTo(x + width, y + height - radius);
  context.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
  context.lineTo(x + radius, y + height);
  context.quadraticCurveTo(x, y + height, x, y + height - radius);
  context.lineTo(x, y + radius);
  context.quadraticCurveTo(x, y, x + radius, y);
  context.closePath();
}

function interactiveBundleForRun(run: GameWorksheetRunSnapshot | null): InteractiveWorksheetBundle | null {
  const artifact = artifactForStage(run, "interactive_bundle");
  if (!artifact || artifact.status !== "completed") {
    return null;
  }
  return {
    fillTargets: worksheetFillTargetsFromPayload(artifact.payload),
    pages: Array.isArray(artifact.payload.pages) ? (artifact.payload.pages as InteractiveWorksheetBundle["pages"]) : [],
    sections: worksheetSectionsFromPayload(artifact.payload)
  };
}

function templatePayloadForRun(run: GameWorksheetRunSnapshot): Record<string, unknown> {
  return artifactForStage(run, "template")?.payload ?? run.templatePayload;
}

function worksheetPagesFromPayload(payload: Record<string, unknown> | null | undefined): Array<{id: string; pageNumber?: number}> {
  const pages = Array.isArray(payload?.pages) ? payload.pages : [];
  return pages.flatMap((page) => {
    if (!isRecord(page) || typeof page.id !== "string") {
      return [];
    }
    return [{id: page.id, pageNumber: typeof page.pageNumber === "number" ? page.pageNumber : undefined}];
  });
}

function worksheetPagesForRun(run: GameWorksheetRunSnapshot): Array<{id: string; pageNumber?: number}> {
  const bundle = interactiveBundleForRun(run);
  const template = templatePayloadForRun(run);
  const pages = bundle?.pages?.length ? bundle.pages : worksheetPagesFromPayload(template);
  return pages.length ? pages : [{id: "page_1", pageNumber: 1}];
}

function worksheetSectionsForRun(run: GameWorksheetRunSnapshot): WorksheetSection[] {
  const bundle = interactiveBundleForRun(run);
  const template = templatePayloadForRun(run);
  const templateSections = worksheetSectionsFromPayload(template);
  if (!bundle?.sections?.length) {
    return templateSections;
  }
  const templateById = new Map(templateSections.map((section) => [section.id, section]));
  return bundle.sections.map((section) => ({...templateById.get(section.id), ...section}));
}

function worksheetFillTargetsForRun(run: GameWorksheetRunSnapshot): WorksheetFillTarget[] {
  const bundle = interactiveBundleForRun(run);
  const template = templatePayloadForRun(run);
  return bundle?.fillTargets?.length ? bundle.fillTargets : worksheetFillTargetsFromPayload(template);
}

export function worksheetNarrationForSection(run: GameWorksheetRunSnapshot, sectionId: string): WorksheetNarrationSection | null {
  return worksheetSectionsForRun(run).find((section) => section.id === sectionId)?.narration ?? null;
}

export function worksheetActionsForSection(run: GameWorksheetRunSnapshot, sectionId: string): WorksheetHandwritingAction[] {
  const section = worksheetSectionsForRun(run).find((candidate) => candidate.id === sectionId);
  if (section?.handwritingActions?.length) {
    return section.handwritingActions;
  }
  return worksheetHandwritingActionsFromPayload(artifactForStage(run, "handwriting")?.payload?.actions).filter((action) => action.sectionId === sectionId);
}

export function sectionPlaybackDurationMs(run: GameWorksheetRunSnapshot, sectionId: string) {
  const narration = worksheetNarrationForSection(run, sectionId);
  if (typeof narration?.durationSeconds === "number" && narration.durationSeconds > 0) {
    return Math.max(2_500, narration.durationSeconds * 1000);
  }
  const maxActionEnd = worksheetActionsForSection(run, sectionId).reduce((max, action) => Math.max(max, action.endSeconds ?? 0), 0);
  return Math.max(3_500, maxActionEnd > 0 ? maxActionEnd * 1000 : 5_500);
}

function worksheetTargetRevealText(run: GameWorksheetRunSnapshot, playback: WorksheetPlaybackState, target: WorksheetFillTarget) {
  const sectionId = target.sectionId;
  if (!sectionId) {
    return "";
  }
  if (playback.completedSectionIds.includes(sectionId)) {
    return target.expectedText ?? target.id;
  }
  if (playback.activeSectionId !== sectionId || !playback.activeSectionStartedAt) {
    return "";
  }
  const action = worksheetActionsForSection(run, sectionId).find((candidate) => candidate.fillTargetId === target.id);
  const sourceText = action?.text ?? target.expectedText ?? "";
  if (!sourceText) {
    return "";
  }
  const elapsedSeconds = Math.max(0, (Date.now() - playback.activeSectionStartedAt) / 1000);
  const startSeconds = action?.startSeconds ?? 0;
  const endSeconds = action?.endSeconds ?? Math.max(startSeconds + 1.4, startSeconds + sourceText.length * 0.055);
  if (elapsedSeconds <= startSeconds) {
    return "";
  }
  const progress = Math.max(0, Math.min(1, (elapsedSeconds - startSeconds) / Math.max(0.1, endSeconds - startSeconds)));
  return sourceText.slice(0, Math.max(1, Math.ceil(sourceText.length * progress)));
}

function currentWorksheetPageId(run: GameWorksheetRunSnapshot, playback: WorksheetPlaybackState) {
  const pages = worksheetPagesForRun(run);
  if (playback.currentPageId && pages.some((page) => page.id === playback.currentPageId)) {
    return playback.currentPageId;
  }
  return pages[0]?.id ?? "page_1";
}

function nextWorksheetPageId(run: GameWorksheetRunSnapshot, currentPageId: string) {
  const pages = worksheetPagesForRun(run);
  const currentIndex = pages.findIndex((page) => page.id === currentPageId);
  if (currentIndex < 0 || currentIndex >= pages.length - 1) {
    return null;
  }
  return pages[currentIndex + 1]?.id ?? null;
}

function pageSectionsForRun(run: GameWorksheetRunSnapshot, pageId: string) {
  return worksheetSectionsForRun(run).filter((section) => (section.pageId ?? "page_1") === pageId);
}

function isWorksheetPageComplete(run: GameWorksheetRunSnapshot, playback: WorksheetPlaybackState, pageId: string) {
  const completedSections = new Set(playback.completedSectionIds);
  const sections = pageSectionsForRun(run, pageId);
  return sections.length > 0 && sections.every((section) => completedSections.has(section.id));
}

export function areAllWorksheetSectionsComplete(run: GameWorksheetRunSnapshot, playback: WorksheetPlaybackState) {
  const sections = worksheetSectionsForRun(run);
  const completedSections = new Set(playback.completedSectionIds);
  return sections.length > 0 && sections.every((section) => completedSections.has(section.id));
}

function worksheetSectionsFromPayload(payload: Record<string, unknown> | null | undefined): WorksheetSection[] {
  const sections = Array.isArray(payload?.sections) ? payload.sections : [];
  return sections.flatMap((section) => {
    if (!isRecord(section) || typeof section.title !== "string") {
      return [];
    }
    const id = typeof section.id === "string" ? section.id : typeof section.sectionId === "string" ? section.sectionId : null;
    if (!id) {
      return [];
    }
    return [
      {
        id,
        completionMode: typeof section.completionMode === "string" ? section.completionMode : undefined,
        handwritingActions: worksheetHandwritingActionsFromPayload(section.handwritingActions),
        narration: worksheetNarrationFromPayload(section.narration),
        pageId: typeof section.pageId === "string" ? section.pageId : undefined,
        regionId: typeof section.regionId === "string" ? section.regionId : undefined,
        summary: typeof section.summary === "string" ? section.summary : undefined,
        title: section.title
      }
    ];
  });
}

function worksheetNarrationFromPayload(value: unknown): WorksheetNarrationSection | undefined {
  if (!isRecord(value)) {
    return undefined;
  }
  return {
    audioUrl: typeof value.audioUrl === "string" ? value.audioUrl : null,
    durationSeconds: typeof value.durationSeconds === "number" ? value.durationSeconds : undefined,
    sectionId: typeof value.sectionId === "string" ? value.sectionId : undefined,
    speechText: typeof value.speechText === "string" ? value.speechText : undefined
  };
}

function worksheetHandwritingActionsFromPayload(value: unknown): WorksheetHandwritingAction[] {
  const actions = Array.isArray(value) ? value : [];
  return actions.flatMap((action) => {
    if (!isRecord(action) || typeof action.id !== "string") {
      return [];
    }
    return [
      {
        endSeconds: typeof action.endSeconds === "number" ? action.endSeconds : undefined,
        fillTargetId: typeof action.fillTargetId === "string" ? action.fillTargetId : undefined,
        id: action.id,
        sectionId: typeof action.sectionId === "string" ? action.sectionId : undefined,
        startSeconds: typeof action.startSeconds === "number" ? action.startSeconds : undefined,
        text: typeof action.text === "string" ? action.text : undefined
      }
    ];
  });
}

function worksheetFillTargetsFromPayload(payload: Record<string, unknown> | null | undefined): WorksheetFillTarget[] {
  const fillTargets = Array.isArray(payload?.fillTargets) ? payload.fillTargets : [];
  return fillTargets.flatMap((target) => {
    if (!isRecord(target) || typeof target.id !== "string" || !isWorksheetRect(target.rect)) {
      return [];
    }
    return [
      {
        expectedText: typeof target.expectedText === "string" ? target.expectedText : undefined,
        id: target.id,
        pageId: typeof target.pageId === "string" ? target.pageId : undefined,
        questionId: typeof target.questionId === "string" ? target.questionId : undefined,
        rect: target.rect,
        sectionId: typeof target.sectionId === "string" ? target.sectionId : undefined
      }
    ];
  });
}

function sectionDisplayRects(sections: WorksheetSection[]) {
  const rects = new Map<string, {height: number; width: number; x: number; y: number}>();
  const fallback = [
    {height: 150, width: 998, x: 96, y: 275},
    {height: 150, width: 998, x: 96, y: 450},
    {height: 150, width: 998, x: 96, y: 1090}
  ];
  sections.forEach((section, index) => {
    rects.set(section.id, fallback[index] ?? {height: 132, width: 998, x: 96, y: 275 + index * 160});
  });
  return rects;
}

function wrapWorksheetText(
  context: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  maxWidth: number,
  lineHeight: number,
  maxLines: number
) {
  const words = text.split(/\s+/);
  let line = "";
  let currentY = y;
  let lines = 0;
  for (const word of words) {
    const next = line ? `${line} ${word}` : word;
    if (context.measureText(next).width > maxWidth && line) {
      context.fillText(line, x, currentY);
      lines += 1;
      if (lines >= maxLines) {
        return;
      }
      line = word;
      currentY += lineHeight;
    } else {
      line = next;
    }
  }
  if (line && lines < maxLines) {
    context.fillText(line, x, currentY);
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isWorksheetRect(value: unknown): value is WorksheetRect {
  return (
    isRecord(value) &&
    typeof value.x === "number" &&
    typeof value.y === "number" &&
    typeof value.width === "number" &&
    typeof value.height === "number"
  );
}

export function choiceAtCanvasPoint(x: number, y: number) {
  return LESSON_CHOICES.find((choice) => x >= choice.box.x && x <= choice.box.x + choice.box.width && y >= choice.box.y && y <= choice.box.y + choice.box.height) ?? null;
}

export function worksheetActionAtCanvasPoint(
  x: number,
  y: number,
  run: GameWorksheetRunSnapshot,
  playback: WorksheetPlaybackState
):
  | {pageId: string; type: "next_page"}
  | {section: WorksheetSection; type: "section"}
  | {type: "complete_lesson"}
  | null {
  if (artifactForStage(run, "interactive_bundle")?.status !== "completed") {
    return null;
  }
  const currentPageId = currentWorksheetPageId(run, playback);
  const nextPageId = nextWorksheetPageId(run, currentPageId);
  if (isWorksheetPageComplete(run, playback, currentPageId) && nextPageId && pointInRect(x, y, WORKSHEET_NEXT_PAGE_RECT)) {
    return {pageId: nextPageId, type: "next_page"};
  }
  if (areAllWorksheetSectionsComplete(run, playback) && !nextPageId && pointInRect(x, y, WORKSHEET_COMPLETE_RECT)) {
    return {type: "complete_lesson"};
  }
  const sections = pageSectionsForRun(run, currentPageId);
  const rects = sectionDisplayRects(sections);
  const section =
    sections.find((section) => {
      const rect = rects.get(section.id);
      return rect ? pointInRect(x, y, rect) : false;
    }) ?? null;
  return section ? {section, type: "section"} : null;
}

function pointInRect(x: number, y: number, rect: {height: number; width: number; x: number; y: number}) {
  return x >= rect.x && x <= rect.x + rect.width && y >= rect.y && y <= rect.y + rect.height;
}
