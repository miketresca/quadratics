import * as motionCanvasPackage from "@motion-canvas/vite-plugin";
import {defineConfig} from "vite";

type MotionCanvasPlugin = typeof motionCanvasPackage.default;
type MotionCanvasInterop = {
  default: MotionCanvasPlugin | {default: MotionCanvasPlugin};
};

const motionCanvasModule = motionCanvasPackage as MotionCanvasInterop;
const motionCanvas =
  "default" in motionCanvasModule.default
    ? motionCanvasModule.default.default
    : motionCanvasModule.default;

export default defineConfig({
  plugins: [motionCanvas()]
});
