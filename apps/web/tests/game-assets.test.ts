import {existsSync} from "node:fs";
import path from "node:path";

import {describe, expect, it} from "vitest";

import {GAME_ASSETS, GAME_AUDIO_CUES, GAME_FIGHTERS, getAsset} from "../lib/game/assets";
import {GAME_LESSONS} from "../lib/game/lessons";

const publicRoot = path.resolve(import.meta.dirname, "../public");
const publicPath = (src: string) => path.join(publicRoot, src.replace(/^\//, ""));

describe("game asset manifest", () => {
  it("points every local asset entry to an existing public file or directory", () => {
    for (const asset of GAME_ASSETS) {
      expect(asset.legalStatus).toBe("prototype_reference");
      expect(asset.sourceUrl).toMatch(/^(https:\/\/|assets\/)/);
      expect(existsSync(publicPath(asset.src))).toBe(true);
    }
  });

  it("defines the required playable fighters and lesson assets", () => {
    expect(GAME_FIGHTERS.map((fighter) => fighter.id)).toEqual([
      "mario",
      "donkey-kong",
      "link",
      "samus",
      "captain-falcon",
      "ness",
      "yoshi",
      "kirby",
      "fox",
      "pikachu",
      "luigi",
      "jigglypuff"
    ]);
    expect(getAsset("lesson-orb").src).toBe("/game/assets/ui/smash-ball.png");
    expect(getAsset("locked-orb").src).toBe("/game/assets/ui/locked-ball.svg");
    expect(GAME_LESSONS.map((lesson) => lesson.id)).toEqual([
      "volume-cubes-lesson-1",
      "dynamic-lesson-locked",
      "dynamic-lesson-3-locked"
    ]);
  });

  it("ships real audio cues for character select and core actions", () => {
    for (const src of Object.values(GAME_AUDIO_CUES)) {
      expect(existsSync(publicPath(src))).toBe(true);
    }
  });
});
