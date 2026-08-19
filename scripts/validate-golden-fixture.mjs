import {readFileSync} from "node:fs";
import {dirname, join} from "node:path";
import {fileURLToPath} from "node:url";

const repoRoot = dirname(dirname(fileURLToPath(import.meta.url)));
const root = join(repoRoot, "fixtures/golden/x2-plus-5x-plus-6");

function readJson(name) {
  return JSON.parse(readFileSync(join(root, name), "utf8"));
}

const lesson = readJson("lesson.json");
const script = readJson("script.json");
const narration = readJson("narration.json");

const stepIds = new Set(lesson.steps.map((step) => step.id));
const mathLineIds = new Set(
  lesson.steps.flatMap((step) => step.mathLines.map((line) => line.id)),
);

for (const segment of script.segments) {
  if (!stepIds.has(segment.stepId)) {
    throw new Error(`Unknown script stepId: ${segment.stepId}`);
  }
  for (const mathLineId of segment.mathLineIds) {
    if (!mathLineIds.has(mathLineId)) {
      throw new Error(`Unknown script mathLineId: ${mathLineId}`);
    }
  }
}

for (const segment of narration.segments) {
  const scriptSegment = script.segments.find((candidate) => candidate.id === segment.scriptSegmentId);
  if (!scriptSegment) {
    throw new Error(`Unknown narration scriptSegmentId: ${segment.scriptSegmentId}`);
  }
  if (scriptSegment.stepId !== segment.stepId) {
    throw new Error(`Narration step mismatch for ${segment.scriptSegmentId}`);
  }
  for (const alignmentKey of ["alignment", "normalizedAlignment"]) {
    const alignment = segment[alignmentKey];
    if (!alignment) continue;
    const lengths = [
      alignment.characters.length,
      alignment.characterStartTimesSeconds.length,
      alignment.characterEndTimesSeconds.length,
    ];
    if (new Set(lengths).size !== 1) {
      throw new Error(`Mismatched ${alignmentKey} arrays for ${segment.scriptSegmentId}`);
    }
  }
}

console.log("Golden fixture is valid");
