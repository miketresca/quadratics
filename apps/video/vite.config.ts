import * as ffmpegPackage from "@motion-canvas/ffmpeg";
import * as motionCanvasPackage from "@motion-canvas/vite-plugin";
import {defineConfig} from "vite";

type MotionCanvasPlugin = typeof motionCanvasPackage.default;
type FfmpegPlugin = typeof ffmpegPackage.default;
type MotionCanvasInterop = {
  default: MotionCanvasPlugin | {default: MotionCanvasPlugin};
};
type FfmpegInterop = {
  default: FfmpegPlugin | {default: FfmpegPlugin};
};

const motionCanvasModule = motionCanvasPackage as MotionCanvasInterop;
const motionCanvas =
  "default" in motionCanvasModule.default
    ? motionCanvasModule.default.default
    : motionCanvasModule.default;
const ffmpegModule = ffmpegPackage as FfmpegInterop;
const ffmpeg =
  "default" in ffmpegModule.default
    ? ffmpegModule.default.default
    : ffmpegModule.default;

export default defineConfig({
  plugins: [motionCanvas(), ffmpeg()]
});
