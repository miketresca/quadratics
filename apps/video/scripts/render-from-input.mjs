import {spawn} from "node:child_process";
import {cpus, tmpdir} from "node:os";
import {mkdtemp, readdir, readFile, rm, stat, writeFile} from "node:fs/promises";
import {existsSync} from "node:fs";
import {resolve} from "node:path";

import {createServer} from "vite";

const repoRoot = resolve(new URL("../../..", import.meta.url).pathname);
const videoRoot = resolve(repoRoot, "apps/video");
const inputPath = process.env.QUADRATICS_RENDER_INPUT_PATH;
const outputPath = process.env.QUADRATICS_RENDER_OUTPUT_PATH;
const chromeBin =
  process.env.CHROME_BIN ??
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const fps = Number(process.env.QUADRATICS_RENDER_FPS ?? "30");

if (!inputPath || !outputPath) {
  throw new Error("QUADRATICS_RENDER_INPUT_PATH and QUADRATICS_RENDER_OUTPUT_PATH are required");
}

const generatedInputPath = resolve(videoRoot, "src/data/render-input.generated.json");
const outputDir = resolve(videoRoot, "output");

const originalGeneratedInput = await readFile(generatedInputPath, "utf-8");
const renderInput = JSON.parse(await readFile(inputPath, "utf-8"));
const virtualTimeBudgetMs = virtualTimeBudgetForRender(renderInput);
await writeFile(generatedInputPath, JSON.stringify(renderInput), "utf-8");
await rm(outputDir, {recursive: true, force: true});
const tempDir = await mkdtemp(resolve(tmpdir(), "quadratics-video-"));

const server = await createServer({
  root: videoRoot,
  server: {
    host: "127.0.0.1",
    port: 0,
    strictPort: false
  },
  logLevel: "warn"
});

await server.listen();
const address = server.httpServer?.address();
if (!address || typeof address === "string") {
  await server.close();
  throw new Error("Could not determine Motion Canvas server port");
}

try {
  await run(chromeBin, [
    "--headless=new",
    "--disable-gpu",
    "--no-first-run",
    "--run-all-compositor-stages-before-draw",
    `--virtual-time-budget=${virtualTimeBudgetMs}`,
    "--window-size=1920,1080",
    `http://127.0.0.1:${address.port}/?render`
  ]);
  const frameExport = await waitForRenderedFrames(outputDir);
  if (!frameExport) {
    throw new Error(`Motion Canvas did not create PNG frames. ${renderInputSummary(renderInput)}`);
  }
  const narrationAudioPath = await prepareNarrationAudio(renderInput, tempDir);
  const avatarVideoPaths = await prepareAvatarVideos(renderInput, tempDir);
  const encodedVideoPath = avatarVideoPaths.length > 0 ? resolve(tempDir, "base-video.mp4") : outputPath;
  const ffmpegArgs = [
    "-y",
    "-framerate",
    String(fps),
    "-i",
    frameExport.pattern
  ];
  if (narrationAudioPath) {
    ffmpegArgs.push("-i", narrationAudioPath);
  }
  ffmpegArgs.push(
    "-c:v",
    "libx264",
    "-pix_fmt",
    "yuv420p",
    "-threads",
    String(Math.max(1, Math.min(4, cpus().length)))
  );
  if (narrationAudioPath) {
    ffmpegArgs.push("-map", "0:v", "-map", "1:a", "-c:a", "aac", "-b:a", "160k", "-shortest");
  }
  ffmpegArgs.push(encodedVideoPath);
  await run("ffmpeg", ffmpegArgs);
  if (avatarVideoPaths.length > 0) {
    await compositeAvatarVideos(encodedVideoPath, avatarVideoPaths, outputPath);
  }
} finally {
  await server.close();
  await writeFile(generatedInputPath, originalGeneratedInput, "utf-8");
  await rm(tempDir, {recursive: true, force: true});
}

async function prepareAvatarVideos(renderInput, tempDir) {
  const storageObjects = Array.isArray(renderInput?.avatarStorageObjects)
    ? renderInput.avatarStorageObjects
    : [];
  const objects = storageObjects.filter((candidate) => candidate?.signedUrl);
  const avatarPaths = [];
  for (const [index, object] of objects.entries()) {
    const response = await fetch(object.signedUrl);
    if (!response.ok) {
      throw new Error(`Could not download avatar video: ${response.status}`);
    }
    const contentType = String(object.contentType ?? "");
    const extension = contentType.includes("webm") ? "webm" : "mp4";
    const avatarPath = resolve(tempDir, `avatar-${String(index).padStart(3, "0")}.${extension}`);
    await writeFile(avatarPath, Buffer.from(await response.arrayBuffer()));
    avatarPaths.push(avatarPath);
  }
  return avatarPaths;
}

async function compositeAvatarVideos(baseVideoPath, avatarVideoPaths, outputPath) {
  const inputs = ["-i", baseVideoPath];
  for (const avatarVideoPath of avatarVideoPaths) {
    if (avatarVideoPath.endsWith(".webm")) {
      // HeyGen transparent WebMs use VP9 alpha; FFmpeg's native decoder can drop it.
      inputs.push("-c:v", "libvpx-vp9");
    }
    inputs.push("-i", avatarVideoPath);
  }
  const avatarInput = avatarInputFilter(avatarVideoPaths.length);
  await run("ffmpeg", [
    "-y",
    ...inputs,
    "-filter_complex",
    `${avatarInput}scale=420:-1,format=rgba[avatar];[0:v][avatar]overlay=80:H-h-80:format=auto[v]`,
    "-map",
    "[v]",
    "-map",
    "0:a?",
    "-c:v",
    "libx264",
    "-pix_fmt",
    "yuv420p",
    "-c:a",
    "copy",
    "-shortest",
    outputPath
  ]);
}

function avatarInputFilter(avatarVideoCount) {
  if (avatarVideoCount === 1) {
    return "[1:v]format=rgba[avatarraw];[avatarraw]";
  }
  const formattedInputs = Array.from({length: avatarVideoCount}, (_value, index) => {
    const inputIndex = index + 1;
    return `[${inputIndex}:v]format=rgba[avatar${index}];`;
  }).join("");
  const concatInputs = Array.from({length: avatarVideoCount}, (_value, index) => `[avatar${index}]`).join("");
  return `${formattedInputs}${concatInputs}concat=n=${avatarVideoCount}:v=1:a=0[avatarraw];[avatarraw]`;
}

async function prepareNarrationAudio(renderInput, tempDir) {
  const segments = Array.isArray(renderInput?.narration?.segments)
    ? renderInput.narration.segments
    : [];
  const storageObjects = Array.isArray(renderInput?.narrationStorageObjects)
    ? renderInput.narrationStorageObjects
    : [];
  if (segments.length === 0 || storageObjects.length === 0) {
    return null;
  }

  const objectsBySegment = new Map(
    storageObjects
      .filter((object) => object?.signedUrl && object?.metadata?.scriptSegmentId)
      .map((object) => [object.metadata.scriptSegmentId, object])
  );
  const segmentPaths = [];
  for (const [index, segment] of segments.entries()) {
    const object = objectsBySegment.get(segment.scriptSegmentId);
    if (!object?.signedUrl) {
      return null;
    }
    const response = await fetch(object.signedUrl);
    if (!response.ok) {
      throw new Error(`Could not download narration segment ${segment.scriptSegmentId}: ${response.status}`);
    }
    const audioPath = resolve(tempDir, `narration-${String(index).padStart(3, "0")}.mp3`);
    await writeFile(audioPath, Buffer.from(await response.arrayBuffer()));
    segmentPaths.push(audioPath);
  }

  if (segmentPaths.length === 1) {
    return segmentPaths[0];
  }

  const concatListPath = resolve(tempDir, "narration-files.txt");
  await writeFile(
    concatListPath,
    segmentPaths.map((path) => `file '${escapeConcatPath(path)}'`).join("\n"),
    "utf-8"
  );
  const combinedPath = resolve(tempDir, "narration.mp3");
  try {
    await run("ffmpeg", ["-y", "-f", "concat", "-safe", "0", "-i", concatListPath, "-c", "copy", combinedPath]);
  } catch {
    await run("ffmpeg", ["-y", "-f", "concat", "-safe", "0", "-i", concatListPath, combinedPath]);
  }
  return combinedPath;
}

function virtualTimeBudgetForRender(renderInput) {
  const timelineDuration = Number(renderInput?.timeline?.durationSeconds ?? 0);
  const cueEnds = Array.isArray(renderInput?.timeline?.cues)
    ? renderInput.timeline.cues.flatMap((cue) => [
        Number(cue?.animation?.endSeconds ?? 0),
        Number(cue?.narration?.endSeconds ?? 0),
        Number(cue?.sfx?.endSeconds ?? 0)
      ])
    : [];
  const segmentEnds = Array.isArray(renderInput?.narration?.segments)
    ? renderInput.narration.segments.map((segment) => Number(segment?.endSeconds ?? 0))
    : [];
  const durationSeconds = Math.max(0, timelineDuration, ...cueEnds, ...segmentEnds);
  return Math.max(300000, Math.ceil(durationSeconds * 10000) + 60000);
}

async function waitForRenderedFrames(directory) {
  for (let attempt = 0; attempt < 300; attempt += 1) {
    const exportLocation = await findRenderedFrames(directory);
    if (exportLocation) {
      return exportLocation;
    }
    await new Promise((resolveWait) => setTimeout(resolveWait, 200));
  }
  return null;
}

async function findRenderedFrames(directory) {
  if (!existsSync(directory)) {
    return null;
  }
  const entries = await readdir(directory);
  const directFrames = entries.filter((file) => file.endsWith(".png"));
  if (directFrames.length > 0) {
    return {count: directFrames.length, pattern: resolve(directory, "%06d.png")};
  }
  for (const entry of entries) {
    const child = resolve(directory, entry);
    const childStat = await stat(child);
    if (!childStat.isDirectory()) {
      continue;
    }
    const childEntries = await readdir(child);
    const childFrames = childEntries.filter((file) => file.endsWith(".png"));
    if (childFrames.length > 0) {
      return {count: childFrames.length, pattern: resolve(child, "%06d.png")};
    }
  }
  return null;
}

function renderInputSummary(renderInput) {
  const cues = Array.isArray(renderInput?.timeline?.cues) ? renderInput.timeline.cues : [];
  const actions = [...new Set(cues.map((cue) => cue?.animation?.action).filter(Boolean))].join(", ") || "none";
  return `Render input: ${cues.length} cue(s), ${Number(renderInput?.timeline?.durationSeconds ?? 0).toFixed(2)}s, actions: ${actions}.`;
}

function escapeConcatPath(path) {
  return path.replaceAll("'", "'\\''");
}

function run(command, args) {
  return new Promise((resolveRun, rejectRun) => {
    const child = spawn(command, args, {
      cwd: videoRoot,
      stdio: ["ignore", "pipe", "pipe"]
    });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (chunk) => {
      stdout += chunk;
    });
    child.stderr.on("data", (chunk) => {
      stderr += chunk;
    });
    child.on("error", rejectRun);
    child.on("close", (code) => {
      if (code === 0) {
        resolveRun();
        return;
      }
      rejectRun(new Error(`${command} exited ${code}: ${stderr || stdout}`));
    });
  });
}
