import {describe, expect, it} from "vitest";
import fixture from "./fixtures/generation_snapshot.json";
import type {GenerationArtifact, GenerationArtifactDependency} from "../src";

interface GenerationSnapshotFixture {
  generationJobId: string;
  artifacts: GenerationArtifact[];
  dependencies: GenerationArtifactDependency[];
}

describe("artifact contract", () => {
  it("accepts a generation snapshot with completed, stale, failed, and skipped artifacts", () => {
    const snapshot = fixture as GenerationSnapshotFixture;

    expect(snapshot.artifacts.map((artifact) => artifact.status)).toEqual([
      "completed",
      "stale",
      "failed",
      "skipped"
    ]);
    expect(snapshot.artifacts[0].storageObjects?.[0]?.bucket).toBe("generated-media");
    expect(snapshot.artifacts[1].staleReason).toContain("Narration");
    expect(snapshot.artifacts[2].errorCode).toBe("renderer_failed");
    expect(snapshot.dependencies[0].upstreamArtifactId).toBe(snapshot.artifacts[0].id);
  });
});
