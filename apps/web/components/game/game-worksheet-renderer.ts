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
  WORKSHEET_COMPLETE_RECT
} from "./game-scene-config";
import type {
  InteractiveWorksheetBundle,
  WorksheetFillTarget,
  WorksheetHandwritingAction,
  WorksheetNarrationSection,
  WorksheetRect,
  WorksheetSection
} from "./game-types";

const PAPER_RECT = {
  height: WORKSHEET_CANVAS_HEIGHT - 92,
  width: WORKSHEET_CANVAS_WIDTH - 92,
  x: 46,
  y: 46
};
const SECTION_SELECTOR_RECT = {
  height: 86,
  width: PAPER_RECT.width - 90,
  x: PAPER_RECT.x + 45,
  y: PAPER_RECT.y + 132
};
const SECTION_VIEWPORT_RECT = {
  height: PAPER_RECT.height - 392,
  width: PAPER_RECT.width - 120,
  x: PAPER_RECT.x + 60,
  y: PAPER_RECT.y + 280
};
const WORKSHEET_TEXTURE_SCALE = 2;
const SECTION_AUDIO_RECT = {
  height: 58,
  width: 250,
  x: SECTION_VIEWPORT_RECT.x + SECTION_VIEWPORT_RECT.width - 286,
  y: SECTION_VIEWPORT_RECT.y + 28
};
const DO_NOW_LAYOUT = {
  problem1: {
    grid: {columns: 4, rows: 3, size: 34, x: 244, y: 518},
    number: {x: 188, y: 466},
    prompt: {
      maxWidth: 790,
      text: "Consider an array of 3 rows of 4 squares. How many squares are there in all? Write a multiplication equation to show your thinking.",
      x: 230,
      y: 460
    },
    equation: {
      label: {x: 244, y: 674},
      line: {height: 42, width: 250, x: 354, y: 632}
    },
    total: {
      label: {x: 244, y: 734},
      line: {height: 42, width: 54, x: 338, y: 692},
      suffix: {x: 406, y: 734}
    }
  },
  problem2: {
    facts: [
      {id: "fill_do_now_fact_3x4", label: "3 x 4 =", labelX: 244, line: {height: 42, width: 44, x: 340, y: 860}},
      {id: "fill_do_now_fact_4x2", label: "4 x 2 =", labelX: 244, line: {height: 42, width: 44, x: 340, y: 910}},
      {id: "fill_do_now_fact_2x5", label: "2 x 5 =", labelX: 244, line: {height: 42, width: 44, x: 340, y: 960}},
      {id: "fill_do_now_fact_5x6", label: "5 x 6 =", labelX: 244, line: {height: 42, width: 44, x: 340, y: 1010}},
      {id: "fill_do_now_fact_4x7", label: "4 x 7 =", labelX: 244, line: {height: 42, width: 44, x: 340, y: 1060}}
    ],
    number: {x: 188, y: 812},
    title: {x: 230, y: 812}
  },
  problem3: {
    area: {
      label: {x: 244, y: 1320},
      line: {height: 44, width: 62, x: 330, y: 1276},
      suffix: {x: 410, y: 1320}
    },
    grid: {columns: 5, rows: 2, size: 34, x: 244, y: 1206},
    number: {x: 188, y: 1142},
    prompt: {x: 230, y: 1176},
    title: {x: 230, y: 1142}
  }
} as const;
const GUIDED_EXAMPLE_LAYOUT = {
  columns: {
    cubesPerLayer: {label: "Cubes per layer", x: 454, width: 148},
    layers: {label: "Number of layers", x: 674, width: 158},
    shape: {label: "Shape", x: 166, width: 236},
    volume: {label: "Volume (cubic units)", x: 888, width: 172}
  },
  headerY: 530,
  rowHeight: 178,
  rowStartY: 574,
  rows: [
    {
      cubes: {count: 6, layers: 1, x: 248, y: 624},
      inputs: {
        cubesPerLayer: {height: 42, width: 92, x: 486, y: 621},
        layers: {height: 42, width: 92, x: 703, y: 621},
        volume: {height: 42, width: 108, x: 904, y: 621}
      }
    },
    {
      cubes: {count: 4, layers: 3, x: 226, y: 818},
      inputs: {
        cubesPerLayer: {height: 42, width: 92, x: 486, y: 799},
        layers: {height: 42, width: 92, x: 703, y: 799},
        volume: {height: 42, width: 108, x: 904, y: 799}
      }
    },
    {
      cubes: {count: 6, layers: 2, x: 236, y: 982},
      inputs: {
        cubesPerLayer: {height: 42, width: 92, x: 486, y: 977},
        layers: {height: 42, width: 92, x: 703, y: 977},
        volume: {height: 42, width: 108, x: 904, y: 977}
      }
    },
    {
      cubes: {count: 10, layers: 2, x: 236, y: 1146},
      inputs: {
        cubesPerLayer: {height: 42, width: 92, x: 486, y: 1155},
        layers: {height: 42, width: 92, x: 703, y: 1155},
        volume: {height: 42, width: 108, x: 904, y: 1155}
      }
    }
  ],
  table: {height: 790, width: 894, x: 166, y: 474}
} as const;
const CUSTOM_FILL_TARGET_RECTS: Record<string, WorksheetRect> = {
  fill_guided_row_1_layer: GUIDED_EXAMPLE_LAYOUT.rows[0].inputs.cubesPerLayer,
  fill_guided_row_1_layers: GUIDED_EXAMPLE_LAYOUT.rows[0].inputs.layers,
  fill_guided_row_1_volume: GUIDED_EXAMPLE_LAYOUT.rows[0].inputs.volume,
  fill_guided_row_2_layer: GUIDED_EXAMPLE_LAYOUT.rows[1].inputs.cubesPerLayer,
  fill_guided_row_2_layers: GUIDED_EXAMPLE_LAYOUT.rows[1].inputs.layers,
  fill_guided_row_2_volume: GUIDED_EXAMPLE_LAYOUT.rows[1].inputs.volume,
  fill_guided_row_3_layer: GUIDED_EXAMPLE_LAYOUT.rows[2].inputs.cubesPerLayer,
  fill_guided_row_3_layers: GUIDED_EXAMPLE_LAYOUT.rows[2].inputs.layers,
  fill_guided_row_3_volume: GUIDED_EXAMPLE_LAYOUT.rows[2].inputs.volume,
  fill_guided_row_4_layer: GUIDED_EXAMPLE_LAYOUT.rows[3].inputs.cubesPerLayer,
  fill_guided_row_4_layers: GUIDED_EXAMPLE_LAYOUT.rows[3].inputs.layers,
  fill_guided_row_4_volume: GUIDED_EXAMPLE_LAYOUT.rows[3].inputs.volume
};
const LESSON_ONE_DO_NOW_TARGETS: Array<Omit<WorksheetFillTarget, "rect">> = [
  {
    expectedText: "3 x 4 = 12",
    id: "fill_do_now_array_equation",
    inputMode: "student_text",
    pageId: "page_1",
    questionId: "do_now_count_layers",
    sectionId: "do_now"
  },
  {
    expectedText: "12",
    id: "fill_do_now_array_total",
    inputMode: "student_text",
    pageId: "page_1",
    questionId: "do_now_count_layers",
    sectionId: "do_now"
  },
  {
    expectedText: "12",
    id: "fill_do_now_fact_3x4",
    inputMode: "student_text",
    pageId: "page_1",
    questionId: "do_now_dimensions",
    sectionId: "do_now"
  },
  {
    expectedText: "8",
    id: "fill_do_now_fact_4x2",
    inputMode: "student_text",
    pageId: "page_1",
    questionId: "do_now_dimensions",
    sectionId: "do_now"
  },
  {
    expectedText: "10",
    id: "fill_do_now_fact_2x5",
    inputMode: "student_text",
    pageId: "page_1",
    questionId: "do_now_dimensions",
    sectionId: "do_now"
  },
  {
    expectedText: "30",
    id: "fill_do_now_fact_5x6",
    inputMode: "student_text",
    pageId: "page_1",
    questionId: "do_now_dimensions",
    sectionId: "do_now"
  },
  {
    expectedText: "28",
    id: "fill_do_now_fact_4x7",
    inputMode: "student_text",
    pageId: "page_1",
    questionId: "do_now_dimensions",
    sectionId: "do_now"
  },
  {
    expectedText: "10",
    id: "fill_do_now_area",
    inputMode: "student_text",
    pageId: "page_1",
    questionId: "do_now_meaning",
    sectionId: "do_now"
  }
];
const LESSON_ONE_GUIDED_TARGETS: Array<Omit<WorksheetFillTarget, "rect">> = [
  ["fill_guided_row_1_layer", "6"],
  ["fill_guided_row_1_layers", "1"],
  ["fill_guided_row_1_volume", "6"],
  ["fill_guided_row_2_layer", "4"],
  ["fill_guided_row_2_layers", "3"],
  ["fill_guided_row_2_volume", "12"],
  ["fill_guided_row_3_layer", "6"],
  ["fill_guided_row_3_layers", "2"],
  ["fill_guided_row_3_volume", "12"],
  ["fill_guided_row_4_layer", "10"],
  ["fill_guided_row_4_layers", "2"],
  ["fill_guided_row_4_volume", "20"]
].map(([id, expectedText]) => ({
  expectedText,
  id,
  inputMode: "student_text",
  pageId: "page_1",
  questionId: "guided_volume_table",
  sectionId: "guided_practice"
}));

export function createWorksheetTexture(
  THREE: typeof import("three"),
  checkedLessonId: GameLessonId | null,
  hoveredChoiceId: GameLessonId | null,
  run: GameWorksheetRunSnapshot | null,
  playback: WorksheetPlaybackState
) {
  const canvas = document.createElement("canvas");
  canvas.width = WORKSHEET_CANVAS_WIDTH * WORKSHEET_TEXTURE_SCALE;
  canvas.height = WORKSHEET_CANVAS_HEIGHT * WORKSHEET_TEXTURE_SCALE;
  const texture = new THREE.CanvasTexture(canvas);
  texture.anisotropy = 16;
  texture.generateMipmaps = false;
  texture.minFilter = THREE.LinearFilter;
  texture.magFilter = THREE.LinearFilter;
  texture.colorSpace = THREE.SRGBColorSpace;
  drawWorksheet(canvas, checkedLessonId, hoveredChoiceId, run, playback);
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
  context.setTransform(WORKSHEET_TEXTURE_SCALE, 0, 0, WORKSHEET_TEXTURE_SCALE, 0, 0);
  context.clearRect(0, 0, WORKSHEET_CANVAS_WIDTH, WORKSHEET_CANVAS_HEIGHT);
  context.imageSmoothingEnabled = true;
  context.imageSmoothingQuality = "high";
  drawFlatPaperBackground(context);

  if (checkedLessonId === GAME_LESSON_TEMPLATE_ID && run?.templateId === GAME_LESSON_TEMPLATE_ID) {
    drawGeneratedWorksheet(context, run, playback);
    return;
  }

  context.fillStyle = "#24313f";
  context.font = "700 46px ui-rounded, system-ui, sans-serif";
  context.fillText("Today’s worksheet", 170, 230);
  context.font = "28px ui-rounded, system-ui, sans-serif";
  context.fillStyle = "#64748b";
  context.fillText("Choose a lesson to begin.", 170, 282);

  for (const choice of LESSON_CHOICES) {
    const active = choice.id === checkedLessonId;
    const hovered = choice.id === hoveredChoiceId;
    context.fillStyle = active ? "#e7f8ef" : hovered ? "#f4f0e7" : "#fffdf8";
    context.strokeStyle = choice.locked ? "#d6c7ae" : active ? "#2f9d65" : hovered ? "#7c5f35" : "#cdbfAA";
    context.lineWidth = hovered || active ? 6 : 3;
    roundRect(context, choice.box.x, choice.box.y, choice.box.width, choice.box.height, 20);
    context.fill();
    context.stroke();

    const checkboxX = choice.box.x + 34;
    const checkboxY = choice.box.y + 34;
    context.strokeStyle = choice.locked ? "#a9987f" : "#314155";
    context.lineWidth = 5;
    roundRect(context, checkboxX, checkboxY, 54, 54, 8);
    context.stroke();
    if (active) {
      context.strokeStyle = "#15803d";
      context.lineWidth = 10;
      context.beginPath();
      context.moveTo(checkboxX + 12, checkboxY + 29);
      context.lineTo(checkboxX + 27, checkboxY + 44);
      context.lineTo(checkboxX + 48, checkboxY + 12);
      context.stroke();
    }

    context.fillStyle = choice.locked ? "#8b8173" : "#1f2937";
    context.font = "700 31px ui-rounded, system-ui, sans-serif";
    context.fillText(choice.title, choice.box.x + 116, choice.box.y + 54);
    context.fillStyle = choice.locked ? "#a69b89" : "#64748b";
    context.font = "23px ui-rounded, system-ui, sans-serif";
    context.fillText(choice.subtitle, choice.box.x + 116, choice.box.y + 91);
  }

  context.strokeStyle = "#e7dac4";
  context.lineWidth = 2;
  for (let index = 0; index < 8; index += 1) {
    const y = 980 + index * 44;
    context.beginPath();
    context.moveTo(170, y);
    context.lineTo(970, y);
    context.stroke();
  }

  context.fillStyle = "#9a8973";
  context.font = "23px ui-rounded, system-ui, sans-serif";
  context.fillText("Notes", 170, 938);

}

function drawFlatPaperBackground(context: CanvasRenderingContext2D) {
  context.fillStyle = "#fffdf7";
  context.fillRect(0, 0, WORKSHEET_CANVAS_WIDTH, WORKSHEET_CANVAS_HEIGHT);
  context.strokeStyle = "#ded2bd";
  context.lineWidth = 4;
  context.strokeRect(40, 42, WORKSHEET_CANVAS_WIDTH - 80, WORKSHEET_CANVAS_HEIGHT - 84);
}

function drawGeneratedWorksheet(
  context: CanvasRenderingContext2D,
  run: GameWorksheetRunSnapshot,
  playback: WorksheetPlaybackState
) {
  const sections = worksheetSectionsForRun(run);
  const fillTargets = worksheetFillTargetsForRun(run);
  const complete = artifactForStage(run, "interactive_bundle")?.status === "completed";
  const allSectionsComplete = areAllWorksheetSectionsComplete(run, playback);

  const status = artifactForStage(run, "interactive_bundle")?.status ?? "waiting";
  const activeSection = activeWorksheetSection(sections, playback);
  drawWorksheetHeader(context, activeSection, status, complete);

  const selectorRects = sectionSelectorRects(sections);
  for (const section of sections) {
    const rect = selectorRects.get(section.id);
    if (!rect) {
      continue;
    }
    const answerStatus = worksheetSectionAnswerStatus(run, playback, section.id);
    const completed = answerStatus === "complete";
    const incorrect = answerStatus === "incorrect";
    const selected = activeSection?.id === section.id;
    context.fillStyle = incorrect ? "#fef2f2" : selected ? "#ecfdf5" : completed ? "#f0fdf4" : "#fffdf8";
    context.strokeStyle = incorrect ? "#dc2626" : selected ? "#0f766e" : completed ? "#2f9d65" : "#d8c9ad";
    context.lineWidth = selected || completed || incorrect ? 5 : 2;
    roundRect(context, rect.x, rect.y, rect.width, rect.height, 12);
    context.fill();
    context.stroke();
    context.fillStyle = incorrect ? "#991b1b" : selected ? "#064e3b" : completed ? "#166534" : "#334155";
    context.font = "900 22px ui-rounded, system-ui, sans-serif";
    context.fillText(sectionTitleForDisplay(section), rect.x + 22, rect.y + 36);
    context.fillStyle = "#64748b";
    context.font = "17px ui-rounded, system-ui, sans-serif";
    wrapWorksheetText(context, section.summary ?? "Worksheet section", rect.x + 22, rect.y + 62, rect.width - 54, 21, 1);
    if (completed) {
      context.strokeStyle = "#15803d";
      context.lineWidth = 6;
      context.beginPath();
      context.moveTo(rect.x + rect.width - 42, rect.y + 30);
      context.lineTo(rect.x + rect.width - 27, rect.y + 46);
      context.lineTo(rect.x + rect.width - 10, rect.y + 20);
      context.stroke();
    } else if (incorrect) {
      context.strokeStyle = "#dc2626";
      context.lineWidth = 6;
      context.beginPath();
      context.moveTo(rect.x + rect.width - 42, rect.y + 22);
      context.lineTo(rect.x + rect.width - 14, rect.y + 50);
      context.moveTo(rect.x + rect.width - 14, rect.y + 22);
      context.lineTo(rect.x + rect.width - 42, rect.y + 50);
      context.stroke();
    }
  }

  if (activeSection) {
    drawCustomWorksheetSection(context, activeSection);
    drawSectionAudioButton(context, complete);
  }

  for (const target of fillTargets.filter((candidate) => !activeSection || candidate.sectionId === activeSection.id)) {
    const box = canvasRectForTarget(target, activeSection);
    const readOnly = isReadOnlyTarget(target);
    const revealedText = readOnly ? worksheetTargetRevealText(run, playback, target) : "";
    const activeInput = playback.activeFillTargetId === target.id;
    const answerText = worksheetDisplayAnswer(target.id, playback.answers[target.id] ?? "");
    const result = playback.answerResults[target.id];
    if (readOnly) {
      continue;
    }
    if (target.sectionId === "do_now" || target.sectionId === "guided_practice") {
      drawWorksheetLineInput(context, box, answerText, activeInput, result);
      continue;
    }
    context.fillStyle = activeInput ? "rgba(236, 253, 245, 0.76)" : "rgba(255, 255, 255, 0.68)";
    context.strokeStyle = result?.correct ? "#16a34a" : result && !result.correct ? "#dc2626" : activeInput ? "#0f9f6e" : "#d6c7ae";
    context.lineWidth = activeInput || result ? 5 : 3;
    roundRect(context, box.x, box.y, box.width, box.height, 12);
    context.fill();
    context.stroke();
    context.fillStyle = answerText ? "#1e3a8a" : "#9a8973";
    context.font = answerText || revealedText ? "28px Chalkboard SE, Comic Sans MS, ui-rounded, system-ui, sans-serif" : "24px ui-rounded, system-ui, sans-serif";
    const targetText = answerText || revealedText || (complete ? "click to type" : "waiting for bundle");
    context.fillText(targetText.slice(0, 72), box.x + 16, box.y + box.height * 0.65);
    if (result && !result.correct) {
      context.fillStyle = "#991b1b";
      context.font = "20px ui-rounded, system-ui, sans-serif";
      wrapWorksheetText(context, result.explanation ?? "Review this answer with the teacher explanation.", box.x, box.y + box.height + 28, box.width, 24, 2);
    }
  }

  const doNowCheckable = complete && activeSection?.id === "do_now";
  const allAnswersCorrect = areWorksheetAnswersCorrect(run, playback);
  if (doNowCheckable) {
    context.fillStyle = "#e0f2fe";
    context.strokeStyle = "#0284c7";
    context.lineWidth = 4;
    roundRect(context, WORKSHEET_COMPLETE_RECT.x, WORKSHEET_COMPLETE_RECT.y, WORKSHEET_COMPLETE_RECT.width, WORKSHEET_COMPLETE_RECT.height, 18);
    context.fill();
    context.stroke();
    context.fillStyle = "#075985";
    context.font = "900 23px ui-monospace, SFMono-Regular, Menlo, monospace";
    context.fillText("CHECK ANSWERS", WORKSHEET_COMPLETE_RECT.x + 44, WORKSHEET_COMPLETE_RECT.y + 46);
  } else if (complete && allSectionsComplete && allAnswersCorrect) {
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

  if (playback.lessonCompletedAt || (playback.submittedAt && !allAnswersCorrect)) {
    context.fillStyle = playback.lessonCompletedAt ? "#14532d" : "#991b1b";
    context.font = "24px ui-rounded, system-ui, sans-serif";
    context.fillText(playback.lessonCompletedAt ? "Progress saved." : "Fix the highlighted answers, then check again.", PAPER_RECT.x + 20, 1450);
  }
}

function drawWorksheetHeader(
  context: CanvasRenderingContext2D,
  activeSection: WorksheetSection | null,
  status: string,
  complete: boolean
) {
  context.fillStyle = "#24313f";
  context.font = "900 44px ui-rounded, system-ui, sans-serif";
  context.fillText("Lesson 1", PAPER_RECT.x + 46, PAPER_RECT.y + 56);
  context.fillStyle = "#3f4d5f";
  context.font = "700 23px ui-rounded, system-ui, sans-serif";
  context.fillText("Volume With Whole-Number Cubes", PAPER_RECT.x + 48, PAPER_RECT.y + 92);
  if (activeSection) {
    context.fillStyle = "#0f766e";
    context.font = "900 18px ui-monospace, SFMono-Regular, Menlo, monospace";
    context.fillText(sectionTitleForDisplay(activeSection).toUpperCase(), PAPER_RECT.x + 48, PAPER_RECT.y + 122);
  }

  context.fillStyle = complete ? "#d9f99d" : "#fef3c7";
  context.strokeStyle = complete ? "#15803d" : "#a16207";
  context.lineWidth = 2;
  roundRect(context, WORKSHEET_CANVAS_WIDTH - 380, 86, 300, 44, 12);
  context.fill();
  context.stroke();
  context.fillStyle = complete ? "#14532d" : "#713f12";
  context.font = "800 19px ui-monospace, SFMono-Regular, Menlo, monospace";
  context.fillText(`bundle: ${status}`, WORKSHEET_CANVAS_WIDTH - 350, 116);
}

function drawCustomWorksheetSection(context: CanvasRenderingContext2D, section: WorksheetSection) {
  context.fillStyle = "#fbf7ed";
  context.strokeStyle = "#d7c6a5";
  context.lineWidth = 3;
  roundRect(context, SECTION_VIEWPORT_RECT.x, SECTION_VIEWPORT_RECT.y, SECTION_VIEWPORT_RECT.width, SECTION_VIEWPORT_RECT.height, 18);
  context.fill();
  context.stroke();

  if (section.id === "vocabulary") {
    drawVocabularySection(context);
  } else if (section.id === "guided_practice") {
    drawGuidedPracticeSection(context);
  } else {
    drawDoNowSection(context);
  }
}

function drawSectionAudioButton(context: CanvasRenderingContext2D, enabled: boolean) {
  context.fillStyle = enabled ? "#0f766e" : "#cbd5e1";
  context.strokeStyle = enabled ? "#115e59" : "#94a3b8";
  context.lineWidth = 3;
  roundRect(context, SECTION_AUDIO_RECT.x, SECTION_AUDIO_RECT.y, SECTION_AUDIO_RECT.width, SECTION_AUDIO_RECT.height, 16);
  context.fill();
  context.stroke();
  context.fillStyle = enabled ? "#ffffff" : "#64748b";
  drawSpeakerIcon(context, SECTION_AUDIO_RECT.x + 26, SECTION_AUDIO_RECT.y + 19, 22, enabled ? "#ffffff" : "#64748b");
  context.font = "900 20px ui-rounded, system-ui, sans-serif";
  context.fillText("Explanation", SECTION_AUDIO_RECT.x + 68, SECTION_AUDIO_RECT.y + 38);
}

function drawDoNowSection(context: CanvasRenderingContext2D) {
  const {problem1, problem2, problem3} = DO_NOW_LAYOUT;
  drawSectionTitle(context, "Do Now", "Warm up by counting flat arrays before building volume.");
  drawPromptNumber(context, 1, problem1.number.x, problem1.number.y);
  context.fillStyle = "#24313f";
  context.font = "24px ui-rounded, system-ui, sans-serif";
  wrapWorksheetText(context, problem1.prompt.text, problem1.prompt.x, problem1.prompt.y, problem1.prompt.maxWidth, 28, 2);
  drawGrid(context, problem1.grid.x, problem1.grid.y, problem1.grid.columns, problem1.grid.rows, problem1.grid.size);
  context.fillStyle = "#475569";
  context.font = "22px ui-rounded, system-ui, sans-serif";
  context.fillText("Equation:", problem1.equation.label.x, problem1.equation.label.y);
  context.fillText("There are", problem1.total.label.x, problem1.total.label.y);
  context.fillText("squares in all.", problem1.total.suffix.x, problem1.total.suffix.y);

  drawPromptNumber(context, 2, problem2.number.x, problem2.number.y);
  context.fillStyle = "#24313f";
  context.font = "800 25px ui-rounded, system-ui, sans-serif";
  context.fillText("Solve.", problem2.title.x, problem2.title.y);
  context.fillStyle = "#64748b";
  context.font = "20px ui-rounded, system-ui, sans-serif";
  context.fillText("Write each product.", problem2.title.x, problem2.title.y + 34);
  for (const fact of problem2.facts) {
    context.fillStyle = "#475569";
    context.font = "900 21px ui-monospace, SFMono-Regular, Menlo, monospace";
    context.fillText(fact.label, fact.labelX, fact.line.y + fact.line.height - 8);
  }

  drawPromptNumber(context, 3, problem3.number.x, problem3.number.y);
  context.fillStyle = "#24313f";
  context.font = "800 25px ui-rounded, system-ui, sans-serif";
  context.fillText("Find the area.", problem3.title.x, problem3.title.y);
  context.fillStyle = "#64748b";
  context.font = "20px ui-rounded, system-ui, sans-serif";
  context.fillText("A rectangle is 5 units by 2 units.", problem3.prompt.x, problem3.prompt.y);
  drawGrid(context, problem3.grid.x, problem3.grid.y, problem3.grid.columns, problem3.grid.rows, problem3.grid.size);
  context.fillStyle = "#475569";
  context.font = "900 22px ui-monospace, SFMono-Regular, Menlo, monospace";
  context.fillText("Area =", problem3.area.label.x, problem3.area.label.y);
  context.fillStyle = "#64748b";
  context.font = "20px ui-rounded, system-ui, sans-serif";
  context.fillText("square units", problem3.area.suffix.x, problem3.area.suffix.y);
}

function drawVocabularySection(context: CanvasRenderingContext2D) {
  drawSectionTitle(context, "Vocabulary", "Two words that make the rest of the lesson feel simple.");
  drawVocabularyCard(
    context,
    168,
    500,
    "Volume",
    "The amount of space a solid figure takes up, measured in cubic units.",
    "A box packed with 12 one-inch cubes has a volume of 12 cubic units."
  );
  drawFlatCubeArray(context, 776, 552, 4, 3, 44);
  drawVocabularyCard(
    context,
    168,
    854,
    "Unit Cube",
    "A cube that is 1 unit long, 1 unit wide, and 1 unit tall.",
    "Unit cubes are the building blocks we count to measure volume."
  );
  drawSingleCube(context, 850, 906, 118);
}

function drawGuidedPracticeSection(context: CanvasRenderingContext2D) {
  drawSectionTitle(context, "Guided Example", "Use one clear rule: cubes in a layer times number of layers.");
  const {columns, headerY, rowHeight, rowStartY, rows, table} = GUIDED_EXAMPLE_LAYOUT;
  context.fillStyle = "rgba(255, 250, 240, 0.38)";
  context.strokeStyle = "#d8c9ad";
  context.lineWidth = 2.5;
  roundRect(context, table.x, table.y, table.width, table.height, 16);
  context.fill();
  context.stroke();

  context.fillStyle = "#24313f";
  context.font = "900 18px ui-rounded, system-ui, sans-serif";
  drawCenteredText(context, columns.shape.label, columns.shape.x + columns.shape.width / 2, headerY);
  drawCenteredText(context, columns.cubesPerLayer.label, columns.cubesPerLayer.x + columns.cubesPerLayer.width / 2, headerY);
  drawCenteredText(context, columns.layers.label, columns.layers.x + columns.layers.width / 2, headerY);
  drawCenteredWrappedText(context, columns.volume.label, columns.volume.x + columns.volume.width / 2, headerY - 12, columns.volume.width, 21, 2);

  context.strokeStyle = "#d8c9ad";
  context.lineWidth = 2;
  context.beginPath();
  context.moveTo(table.x, rowStartY);
  context.lineTo(table.x + table.width, rowStartY);
  context.stroke();
  for (let index = 1; index < rows.length; index += 1) {
    const y = rowStartY + index * rowHeight;
    context.strokeStyle = "#e1d5c2";
    context.lineWidth = 2;
    context.beginPath();
    context.moveTo(table.x, y);
    context.lineTo(table.x + table.width, y);
    context.stroke();
  }
  for (const column of [columns.cubesPerLayer, columns.layers, columns.volume]) {
    context.strokeStyle = "#eadfcb";
    context.lineWidth = 2;
    context.beginPath();
    context.moveTo(column.x - 32, table.y);
    context.lineTo(column.x - 32, table.y + table.height);
    context.stroke();
  }

  for (const row of rows) {
    drawStackedCubes(context, row.cubes.x, row.cubes.y, row.cubes.count, row.cubes.layers);
  }
}

function drawSectionTitle(context: CanvasRenderingContext2D, title: string, subtitle: string) {
  context.fillStyle = "#24313f";
  context.font = "900 34px ui-rounded, system-ui, sans-serif";
  context.fillText(title, SECTION_VIEWPORT_RECT.x + 46, SECTION_VIEWPORT_RECT.y + 66);
  context.fillStyle = "#64748b";
  context.font = "21px ui-rounded, system-ui, sans-serif";
  context.fillText(subtitle, SECTION_VIEWPORT_RECT.x + 46, SECTION_VIEWPORT_RECT.y + 102);
}

function drawCenteredText(context: CanvasRenderingContext2D, text: string, centerX: number, y: number) {
  context.fillText(text, centerX - context.measureText(text).width / 2, y);
}

function drawCenteredWrappedText(context: CanvasRenderingContext2D, text: string, centerX: number, y: number, maxWidth: number, lineHeight: number, maxLines: number) {
  const words = text.split(" ");
  let line = "";
  let currentY = y;
  let lineCount = 0;
  for (const word of words) {
    const nextLine = line ? `${line} ${word}` : word;
    if (line && context.measureText(nextLine).width > maxWidth) {
      drawCenteredText(context, line, centerX, currentY);
      currentY += lineHeight;
      line = word;
      lineCount += 1;
      if (lineCount >= maxLines - 1) {
        break;
      }
    } else {
      line = nextLine;
    }
  }
  if (line && lineCount < maxLines) {
    drawCenteredText(context, line, centerX, currentY);
  }
}

function drawPromptNumber(context: CanvasRenderingContext2D, value: number, x: number, y: number) {
  context.fillStyle = "#0f766e";
  context.beginPath();
  context.arc(x, y, 20, 0, Math.PI * 2);
  context.fill();
  context.fillStyle = "#fff";
  context.font = "900 20px ui-rounded, system-ui, sans-serif";
  context.fillText(String(value), x - 6, y + 7);
}

function drawWorksheetLineInput(
  context: CanvasRenderingContext2D,
  box: WorksheetRect,
  answerText: string,
  activeInput: boolean,
  result: {correct?: boolean; explanation?: string | null} | undefined
) {
  const lineY = worksheetLineY(box);
  context.strokeStyle = result?.correct ? "#16a34a" : result && !result.correct ? "#dc2626" : activeInput ? "#0f766e" : "#8b8070";
  context.lineWidth = activeInput || result ? 5 : 3;
  context.beginPath();
  context.moveTo(box.x, lineY);
  context.lineTo(box.x + box.width, lineY);
  context.stroke();
  if (activeInput) {
    context.fillStyle = "rgba(15, 118, 110, 0.12)";
    roundRect(context, box.x - 7, lineY - box.height + 8, box.width + 14, box.height + 2, 8);
    context.fill();
  }
  if (answerText) {
    context.fillStyle = "#1e3a8a";
    context.font = "30px Chalkboard SE, Comic Sans MS, ui-rounded, system-ui, sans-serif";
    context.fillText(answerText.slice(0, 42), box.x + 8, lineY - 6);
  }
  if (result && !result.correct) {
    context.fillStyle = "#991b1b";
    context.font = "18px ui-rounded, system-ui, sans-serif";
    context.fillText("check", box.x + box.width + 14, lineY + 4);
  }
}

function worksheetLineY(box: WorksheetRect) {
  return box.y + box.height;
}

function drawGrid(context: CanvasRenderingContext2D, x: number, y: number, columns: number, rows: number, size: number) {
  context.fillStyle = "#e2e8f0";
  context.strokeStyle = "#64748b";
  context.lineWidth = 3;
  for (let row = 0; row < rows; row += 1) {
    for (let column = 0; column < columns; column += 1) {
      context.fillRect(x + column * size, y + row * size, size, size);
      context.strokeRect(x + column * size, y + row * size, size, size);
    }
  }
}

function drawFlatCubeArray(context: CanvasRenderingContext2D, x: number, y: number, columns: number, rows: number, size: number) {
  const halfWidth = size * 0.5;
  const halfHeight = size * 0.3;
  const depth = size * 0.48;

  context.strokeStyle = "#334155";
  context.lineWidth = 2.2;
  for (let row = rows - 1; row >= 0; row -= 1) {
    for (let column = 0; column < columns; column += 1) {
      const centerX = x + (column - row) * halfWidth;
      const centerY = y + (column + row) * halfHeight;
      const bottom = {x: centerX, y: centerY + halfHeight};
      if (row === rows - 1) {
        context.fillStyle = "#ded6c6";
        drawPolygon(context, [bottom, {x: bottom.x + halfWidth, y: bottom.y - halfHeight}, {x: bottom.x + halfWidth, y: bottom.y + depth - halfHeight}, {x: bottom.x, y: bottom.y + depth}]);
        context.fill();
        context.stroke();
      }
      if (column === 0) {
        context.fillStyle = "#efe7d8";
        drawPolygon(context, [bottom, {x: bottom.x - halfWidth, y: bottom.y - halfHeight}, {x: bottom.x - halfWidth, y: bottom.y + depth - halfHeight}, {x: bottom.x, y: bottom.y + depth}]);
        context.fill();
        context.stroke();
      }
    }
  }

  for (let row = 0; row < rows; row += 1) {
    for (let column = 0; column < columns; column += 1) {
      const centerX = x + (column - row) * halfWidth;
      const centerY = y + (column + row) * halfHeight;
      context.fillStyle = "#f8fafc";
      drawPolygon(context, [
        {x: centerX, y: centerY - halfHeight},
        {x: centerX + halfWidth, y: centerY},
        {x: centerX, y: centerY + halfHeight},
        {x: centerX - halfWidth, y: centerY}
      ]);
      context.fill();
      context.stroke();
    }
  }
}

function drawPolygon(context: CanvasRenderingContext2D, points: Array<{x: number; y: number}>) {
  context.beginPath();
  context.moveTo(points[0].x, points[0].y);
  for (const point of points.slice(1)) {
    context.lineTo(point.x, point.y);
  }
  context.closePath();
}

function drawVocabularyCard(context: CanvasRenderingContext2D, x: number, y: number, title: string, definition: string, example: string) {
  context.fillStyle = "#fffaf0";
  context.strokeStyle = "#d8c9ad";
  context.lineWidth = 3;
  roundRect(context, x, y, 860, 230, 18);
  context.fill();
  context.stroke();
  context.fillStyle = "#0f766e";
  context.font = "900 34px ui-rounded, system-ui, sans-serif";
  context.fillText(title, x + 34, y + 58);
  context.fillStyle = "#334155";
  context.font = "24px ui-rounded, system-ui, sans-serif";
  wrapWorksheetText(context, definition, x + 34, y + 106, 570, 30, 2);
  context.fillStyle = "#64748b";
  context.font = "21px ui-rounded, system-ui, sans-serif";
  wrapWorksheetText(context, example, x + 34, y + 176, 610, 26, 2);
}

function drawStackedCubes(context: CanvasRenderingContext2D, x: number, y: number, count: number, layers: number) {
  const cubeSize = 22;
  for (let layer = 0; layer < layers; layer += 1) {
    for (let index = 0; index < count; index += 1) {
      const column = index % 3;
      const row = Math.floor(index / 3);
      drawSingleCube(context, x + column * (cubeSize + 3) + layer * 16, y + row * (cubeSize + 3) - layer * 14, cubeSize);
    }
  }
}

function drawSingleCube(context: CanvasRenderingContext2D, x: number, y: number, size: number) {
  context.fillStyle = "#dbeafe";
  context.strokeStyle = "#475569";
  context.lineWidth = Math.max(2, size / 18);
  roundRect(context, x, y, size, size, Math.max(3, size / 12));
  context.fill();
  context.stroke();
  context.beginPath();
  context.moveTo(x, y);
  context.lineTo(x + size * 0.22, y - size * 0.18);
  context.lineTo(x + size * 1.22, y - size * 0.18);
  context.lineTo(x + size, y);
  context.stroke();
  context.beginPath();
  context.moveTo(x + size, y);
  context.lineTo(x + size * 1.22, y - size * 0.18);
  context.lineTo(x + size * 1.22, y + size * 0.82);
  context.lineTo(x + size, y + size);
  context.stroke();
}

function drawSpeakerIcon(context: CanvasRenderingContext2D, x: number, y: number, size: number, color: string) {
  context.fillStyle = color;
  context.beginPath();
  context.moveTo(x, y + size * 0.36);
  context.lineTo(x + size * 0.34, y + size * 0.36);
  context.lineTo(x + size * 0.68, y);
  context.lineTo(x + size * 0.68, y + size);
  context.lineTo(x + size * 0.34, y + size * 0.64);
  context.lineTo(x, y + size * 0.64);
  context.closePath();
  context.fill();
  context.strokeStyle = color;
  context.lineWidth = 3;
  context.beginPath();
  context.arc(x + size * 0.75, y + size * 0.5, size * 0.38, -0.65, 0.65);
  context.stroke();
  context.beginPath();
  context.arc(x + size * 0.82, y + size * 0.5, size * 0.62, -0.65, 0.65);
  context.stroke();
}

function sectionTitleForDisplay(section: WorksheetSection) {
  return section.id === "guided_practice" ? "Guided Example" : section.title;
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
  const sourceTargets = bundle?.fillTargets?.length ? bundle.fillTargets : worksheetFillTargetsFromPayload(template);
  if (run.templateId !== GAME_LESSON_TEMPLATE_ID) {
    return sourceTargets;
  }
  const doNowTargets = lessonOneDoNowFillTargets();
  const guidedTargets = lessonOneGuidedFillTargets();
  return [...doNowTargets, ...guidedTargets, ...sourceTargets.filter((target) => target.sectionId !== "do_now" && target.sectionId !== "guided_practice")];
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
  if (playback.answers[target.id]) {
    return playback.answers[target.id];
  }
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

export function worksheetFillTargetAtCanvasPoint(x: number, y: number, run: GameWorksheetRunSnapshot, playback: WorksheetPlaybackState) {
  if (artifactForStage(run, "interactive_bundle")?.status !== "completed") {
    return null;
  }
  const activeSection = activeWorksheetSection(worksheetSectionsForRun(run), playback);
  return (
    worksheetFillTargetsForRun(run).find((target) => {
      if (isReadOnlyTarget(target) || (activeSection && target.sectionId !== activeSection.id)) {
        return false;
      }
      return pointInRect(x, y, canvasRectForTarget(target, activeSection));
    }) ?? null
  );
}

export function worksheetPenPointForActiveInput(run: GameWorksheetRunSnapshot, playback: WorksheetPlaybackState) {
  const activeFillTargetId = playback.activeFillTargetId;
  if (!activeFillTargetId) {
    return null;
  }
  const activeSection = activeWorksheetSection(worksheetSectionsForRun(run), playback);
  const target = worksheetFillTargetsForRun(run).find((candidate) => candidate.id === activeFillTargetId);
  if (!target || isReadOnlyTarget(target) || (activeSection && target.sectionId !== activeSection.id)) {
    return null;
  }
  const box = canvasRectForTarget(target, activeSection);
  const answer = playback.answers[target.id] ?? "";
  const characterAdvance = target.sectionId === "guided_practice" ? 20 : 18;
  return {
    x: Math.min(box.x + box.width - 18, box.x + 18 + answer.length * characterAdvance),
    y: worksheetLineY(box) - 6
  };
}

export function nextWorksheetFillTargetId(run: GameWorksheetRunSnapshot, playback: WorksheetPlaybackState) {
  const activeFillTargetId = playback.activeFillTargetId;
  if (!activeFillTargetId) {
    return null;
  }
  const activeSection = activeWorksheetSection(worksheetSectionsForRun(run), playback);
  const editableTargets = worksheetFillTargetsForRun(run).filter((target) => !isReadOnlyTarget(target) && (!activeSection || target.sectionId === activeSection.id));
  const activeIndex = editableTargets.findIndex((target) => target.id === activeFillTargetId);
  return activeIndex >= 0 ? editableTargets[activeIndex + 1]?.id ?? null : null;
}

export function nextWorksheetAnswerForKey(targetId: string, currentAnswer: string, key: string) {
  const nextAnswer = `${currentAnswer}${key}`;
  if (targetId === "fill_do_now_array_equation") {
    return /^[0-9*xX= ]$/.test(key) ? nextAnswer.slice(0, 12) : currentAnswer;
  }
  if (targetId.startsWith("fill_do_now_")) {
    return /^[0-9]$/.test(key) ? nextAnswer.slice(0, 2) : currentAnswer;
  }
  if (targetId.startsWith("fill_guided_")) {
    return /^[0-9]$/.test(key) ? nextAnswer.slice(0, 2) : currentAnswer;
  }
  return nextAnswer.slice(0, 96);
}

function worksheetDisplayAnswer(targetId: string, answer: string) {
  if (targetId === "fill_do_now_array_equation") {
    return answer.replaceAll(/[^0-9*xX= ]/g, "").slice(0, 12);
  }
  if (targetId.startsWith("fill_do_now_")) {
    return answer.replaceAll(/[^0-9]/g, "").slice(0, 2);
  }
  if (targetId.startsWith("fill_guided_")) {
    return answer.replaceAll(/[^0-9]/g, "").slice(0, 2);
  }
  return answer;
}

export function checkWorksheetAnswers(run: GameWorksheetRunSnapshot, playback: WorksheetPlaybackState) {
  return Object.fromEntries(
    worksheetEditableTargetsForRun(run).flatMap((target) => {
      const answer = playback.answers[target.id] ?? "";
      if (answer.trim().length === 0) {
        return [];
      }
      const correct = isAnswerCorrect(answer, target);
      return [
        [
          target.id,
          {
            correct,
            expectedText: target.expectedText ?? null,
            explanation: correct ? null : explanationForTarget(target)
          }
        ]
      ];
    })
  );
}

export function isWorksheetReadyToSubmit(run: GameWorksheetRunSnapshot, playback: WorksheetPlaybackState) {
  const targets = worksheetEditableTargetsForRun(run);
  return targets.length > 0 && targets.every((target) => (playback.answers[target.id] ?? "").trim().length > 0);
}

export function areWorksheetAnswersCorrect(run: GameWorksheetRunSnapshot, playback: WorksheetPlaybackState) {
  const targets = worksheetEditableTargetsForRun(run);
  return targets.length > 0 && targets.every((target) => (playback.answers[target.id] ?? "").trim().length > 0 && playback.answerResults[target.id]?.correct === true);
}

function worksheetEditableTargetsForRun(run: GameWorksheetRunSnapshot) {
  return worksheetFillTargetsForRun(run).filter((target) => !isReadOnlyTarget(target));
}

export function isWorksheetSectionCorrect(run: GameWorksheetRunSnapshot, playback: WorksheetPlaybackState, sectionId: string) {
  const targets = worksheetEditableTargetsForRun(run).filter((target) => target.sectionId === sectionId);
  return targets.length > 0 && targets.every((target) => (playback.answers[target.id] ?? "").trim().length > 0 && playback.answerResults[target.id]?.correct === true);
}

export function worksheetSectionAnswerStatus(run: GameWorksheetRunSnapshot, playback: WorksheetPlaybackState, sectionId: string) {
  const targets = worksheetEditableTargetsForRun(run).filter((target) => target.sectionId === sectionId);
  if (targets.length === 0 || !playback.submittedAt) {
    return "blank";
  }
  const filledTargets = targets.filter((target) => (playback.answers[target.id] ?? "").trim().length > 0);
  if (filledTargets.some((target) => playback.answerResults[target.id]?.correct === false)) {
    return "incorrect";
  }
  return isWorksheetSectionCorrect(run, playback, sectionId) ? "complete" : "blank";
}

function isReadOnlyTarget(target: WorksheetFillTarget) {
  return target.inputMode === "read_only" || target.sectionId === "vocabulary";
}

function canvasRectForTarget(target: WorksheetFillTarget, activeSection: WorksheetSection | null = null) {
  const doNowRect = doNowFillTargetRect(target.id);
  if (doNowRect) {
    return doNowRect;
  }
  const customRect = CUSTOM_FILL_TARGET_RECTS[target.id];
  if (customRect) {
    return customRect;
  }
  const rect = target.rect;
  const normalized = rect.x <= 1 && rect.y <= 1 && rect.width <= 1 && rect.height <= 1;
  if (!normalized) {
    return rect;
  }
  if (!activeSection) {
    return {
      height: rect.height * PAPER_RECT.height,
      width: rect.width * PAPER_RECT.width,
      x: PAPER_RECT.x + rect.x * PAPER_RECT.width,
      y: PAPER_RECT.y + rect.y * PAPER_RECT.height
    };
  }
  const sourceRect = {height: 1, width: 1, x: 0, y: 0};
  const pageRect = SECTION_VIEWPORT_RECT;
  return {
    height: (rect.height / sourceRect.height) * pageRect.height,
    width: (rect.width / sourceRect.width) * pageRect.width,
    x: pageRect.x + ((rect.x - sourceRect.x) / sourceRect.width) * pageRect.width,
    y: pageRect.y + ((rect.y - sourceRect.y) / sourceRect.height) * pageRect.height
  };
}

function doNowFillTargetRect(targetId: string): WorksheetRect | null {
  if (targetId === "fill_do_now_array_equation") {
    return DO_NOW_LAYOUT.problem1.equation.line;
  }
  if (targetId === "fill_do_now_array_total") {
    return DO_NOW_LAYOUT.problem1.total.line;
  }
  if (targetId === "fill_do_now_area") {
    return DO_NOW_LAYOUT.problem3.area.line;
  }
  const fact = DO_NOW_LAYOUT.problem2.facts.find((candidate) => candidate.id === targetId);
  return fact?.line ?? null;
}

function lessonOneDoNowFillTargets(): WorksheetFillTarget[] {
  return LESSON_ONE_DO_NOW_TARGETS.map((target) => ({
    ...target,
    rect: doNowFillTargetRect(target.id) ?? {height: 0, width: 0, x: 0, y: 0}
  }));
}

function lessonOneGuidedFillTargets(): WorksheetFillTarget[] {
  return LESSON_ONE_GUIDED_TARGETS.map((target) => ({
    ...target,
    rect: CUSTOM_FILL_TARGET_RECTS[target.id] ?? {height: 0, width: 0, x: 0, y: 0}
  }));
}

function isAnswerCorrect(answer: string, target: WorksheetFillTarget) {
  const normalizedAnswer = normalizeAnswer(answer);
  const normalizedExpected = normalizeAnswer(target.expectedText ?? "");
  const compactAnswer = normalizedAnswer.replaceAll(" ", "");
  const compactExpected = normalizedExpected.replaceAll(" ", "");
  if (!normalizedAnswer || !normalizedExpected) {
    return false;
  }
  if (/^\d+$/.test(compactExpected)) {
    return compactAnswer === compactExpected;
  }
  if (normalizedAnswer === normalizedExpected || normalizedAnswer.includes(normalizedExpected) || normalizedExpected.includes(normalizedAnswer)) {
    return true;
  }
  if (compactAnswer === compactExpected || compactAnswer.includes(compactExpected) || compactExpected.includes(compactAnswer)) {
    return true;
  }
  if (target.sectionId === "guided_practice") {
    const expectedNumber = normalizedExpected.match(/\d+/)?.[0];
    return Boolean(expectedNumber && normalizedAnswer.includes(expectedNumber));
  }
  const requiredTokens = normalizedExpected.split(" ").filter((token) => token.length > 3);
  const matchingTokens = requiredTokens.filter((token) => normalizedAnswer.includes(token));
  return requiredTokens.length > 0 && matchingTokens.length / requiredTokens.length >= 0.55;
}

function normalizeAnswer(value: string) {
  return value
    .toLowerCase()
    .replaceAll("×", "x")
    .replaceAll("*", "x")
    .replaceAll(/[^a-z0-9]+/g, " ")
    .trim()
    .replaceAll(/\s+/g, " ");
}

function explanationForTarget(target: WorksheetFillTarget) {
  if (target.sectionId === "guided_practice") {
    return `Use length x width x height. The expected answer is ${target.expectedText ?? "the table value"}.`;
  }
  if (target.questionId === "do_now_dimensions") {
    return "A rectangular prism is described by three dimensions: length, width, and height.";
  }
  if (target.questionId === "do_now_meaning") {
    return "The final volume tells how many unit cubes fill the whole shape.";
  }
  return "Count one complete layer first, then multiply by how many matching layers there are.";
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
        inputMode: target.inputMode === "read_only" ? "read_only" : "student_text",
        pageId: typeof target.pageId === "string" ? target.pageId : undefined,
        questionId: typeof target.questionId === "string" ? target.questionId : undefined,
        rect: target.rect,
        sectionId: typeof target.sectionId === "string" ? target.sectionId : undefined
      }
    ];
  });
}

function activeWorksheetSection(sections: WorksheetSection[], playback: WorksheetPlaybackState) {
  const active = sections.find((section) => section.id === playback.activeSectionId);
  if (active) {
    return active;
  }
  for (let index = playback.completedSectionIds.length - 1; index >= 0; index -= 1) {
    const completed = sections.find((section) => section.id === playback.completedSectionIds[index]);
    if (completed) {
      return completed;
    }
  }
  return sections[0] ?? null;
}

function sectionSelectorRects(sections: WorksheetSection[]) {
  const rects = new Map<string, {height: number; width: number; x: number; y: number}>();
  const gap = 18;
  const count = Math.max(1, sections.length);
  const width = (SECTION_SELECTOR_RECT.width - gap * (count - 1)) / count;
  sections.forEach((section, index) => {
    rects.set(section.id, {
      height: SECTION_SELECTOR_RECT.height,
      width,
      x: SECTION_SELECTOR_RECT.x + index * (width + gap),
      y: SECTION_SELECTOR_RECT.y
    });
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
  | {target: WorksheetFillTarget; type: "fill_target"}
  | {pageId: string; type: "next_page"}
  | {section: WorksheetSection; type: "section"}
  | {section: WorksheetSection; type: "section_audio"}
  | {type: "submit_answers"}
  | {type: "complete_lesson"}
  | null {
  if (artifactForStage(run, "interactive_bundle")?.status !== "completed") {
    return null;
  }
  const fillTarget = worksheetFillTargetAtCanvasPoint(x, y, run, playback);
  if (fillTarget) {
    return {target: fillTarget, type: "fill_target"};
  }
  const sections = worksheetSectionsForRun(run);
  const activeSection = activeWorksheetSection(sections, playback);
  if (activeSection?.id === "do_now" && pointInRect(x, y, WORKSHEET_COMPLETE_RECT)) {
    return {type: "submit_answers"};
  }
  if (
    areAllWorksheetSectionsComplete(run, playback) &&
    areWorksheetAnswersCorrect(run, playback) &&
    pointInRect(x, y, WORKSHEET_COMPLETE_RECT)
  ) {
    return {type: "complete_lesson"};
  }
  if (activeSection && pointInRect(x, y, SECTION_AUDIO_RECT)) {
    return {section: activeSection, type: "section_audio"};
  }
  const rects = sectionSelectorRects(sections);
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
