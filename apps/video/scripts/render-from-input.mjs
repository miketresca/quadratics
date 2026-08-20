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
  const chalkAudioPath = await prepareChalkSfxAudio(renderInput, tempDir);
  const avatarVideoPaths = await prepareAvatarVideos(renderInput, tempDir);
  const encodedVideoPath = avatarVideoPaths.length > 0 ? resolve(tempDir, "base-video.mp4") : outputPath;
  const ffmpegArgs = [
    "-y",
    "-framerate",
    String(fps),
    "-i",
    frameExport.pattern
  ];
  const audioInputs = [];
  if (narrationAudioPath) {
    ffmpegArgs.push("-i", narrationAudioPath);
    audioInputs.push({kind: "narration", index: audioInputs.length + 1});
  }
  if (chalkAudioPath) {
    ffmpegArgs.push("-i", chalkAudioPath);
    audioInputs.push({kind: "chalk", index: audioInputs.length + 1});
  }
  ffmpegArgs.push(
    "-c:v",
    "libx264",
    "-pix_fmt",
    "yuv420p",
    "-threads",
    String(Math.max(1, Math.min(4, cpus().length)))
  );
  if (audioInputs.length === 1) {
    ffmpegArgs.push("-map", "0:v", "-map", `${audioInputs[0].index}:a`, "-c:a", "aac", "-b:a", "160k", "-shortest");
  } else if (audioInputs.length > 1) {
    const mixInputs = audioInputs.map((input) => `[${input.index}:a]`).join("");
    ffmpegArgs.push(
      "-filter_complex",
      `${mixInputs}amix=inputs=${audioInputs.length}:duration=longest:normalize=0[a]`,
      "-map",
      "0:v",
      "-map",
      "[a]",
      "-c:a",
      "aac",
      "-b:a",
      "160k",
      "-shortest"
    );
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

async function prepareChalkSfxAudio(renderInput, tempDir) {
  const cues = Array.isArray(renderInput?.timeline?.cues) ? renderInput.timeline.cues : [];
  const windows = cues
    .map((cue) => cue?.sfx)
    .filter((sfx) => sfx?.type === "chalk_write" && Number.isFinite(sfx.startSeconds) && Number.isFinite(sfx.endSeconds));
  if (windows.length === 0) {
    return null;
  }
  const durationSeconds = Math.max(
    Number(renderInput?.timeline?.durationSeconds ?? 0),
    ...windows.map((window) => Number(window.endSeconds))
  );
  if (!Number.isFinite(durationSeconds) || durationSeconds <= 0) {
    return null;
  }
  const sampleRate = 44100;
  const samples = Math.ceil(durationSeconds * sampleRate);
  const data = Buffer.alloc(samples * 2);
  for (const window of windows) {
    const start = Math.max(0, Math.floor(Number(window.startSeconds) * sampleRate));
    const end = Math.min(samples, Math.ceil(Number(window.endSeconds) * sampleRate));
    for (let index = start; index < end; index += 1) {
      const local = (index - start) / Math.max(1, end - start);
      const envelope = Math.sin(Math.PI * local) * 0.42;
      const scratch = seededNoise(index) * 0.7 + Math.sin(index * 0.19) * 0.2 + Math.sin(index * 0.047) * 0.1;
      const current = data.readInt16LE(index * 2);
      const next = clampInt16(current + scratch * envelope * 32767);
      data.writeInt16LE(next, index * 2);
    }
  }
  const wavPath = resolve(tempDir, "chalk-sfx.wav");
  await writeFile(wavPath, wavBuffer(data, sampleRate));
  return wavPath;
}

function wavBuffer(pcmData, sampleRate) {
  const header = Buffer.alloc(44);
  header.write("RIFF", 0);
  header.writeUInt32LE(36 + pcmData.length, 4);
  header.write("WAVE", 8);
  header.write("fmt ", 12);
  header.writeUInt32LE(16, 16);
  header.writeUInt16LE(1, 20);
  header.writeUInt16LE(1, 22);
  header.writeUInt32LE(sampleRate, 24);
  header.writeUInt32LE(sampleRate * 2, 28);
  header.writeUInt16LE(2, 32);
  header.writeUInt16LE(16, 34);
  header.write("data", 36);
  header.writeUInt32LE(pcmData.length, 40);
  return Buffer.concat([header, pcmData]);
}

function seededNoise(seed) {
  const value = Math.sin(seed * 12.9898) * 43758.5453;
  return (value - Math.floor(value)) * 2 - 1;
}

function clampInt16(value) {
  return Math.max(-32768, Math.min(32767, Math.round(value)));
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
