import {spawn} from "node:child_process";
import {cpus, tmpdir} from "node:os";
import {mkdtemp, readFile, rm, writeFile} from "node:fs/promises";
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
const frameDir = resolve(outputDir, "project");

const originalGeneratedInput = await readFile(generatedInputPath, "utf-8");
const renderInput = JSON.parse(await readFile(inputPath, "utf-8"));
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
    "--virtual-time-budget=30000",
    "--window-size=1920,1080",
    `http://127.0.0.1:${address.port}/?render`
  ]);
  if (!existsSync(frameDir)) {
    throw new Error("Motion Canvas did not create an output frame directory");
  }
  const narrationAudioPath = await prepareNarrationAudio(renderInput, tempDir);
  const avatarVideoPaths = await prepareAvatarVideos(renderInput, tempDir);
  const encodedVideoPath = avatarVideoPaths.length > 0 ? resolve(tempDir, "base-video.mp4") : outputPath;
  const ffmpegArgs = [
    "-y",
    "-framerate",
    String(fps),
    "-i",
    resolve(frameDir, "%06d.png")
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
    ffmpegArgs.push("-c:a", "aac", "-b:a", "160k", "-shortest");
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
    inputs.push("-i", avatarVideoPath);
  }
  const avatarInput =
    avatarVideoPaths.length === 1
      ? "[1:v]"
      : `${avatarVideoPaths.map((_path, index) => `[${index + 1}:v]`).join("")}concat=n=${avatarVideoPaths.length}:v=1:a=0[avatarraw];[avatarraw]`;
  await run("ffmpeg", [
    "-y",
    ...inputs,
    "-filter_complex",
    `${avatarInput}scale=420:-1[avatar];[0:v][avatar]overlay=80:H-h-80:format=auto[v]`,
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
