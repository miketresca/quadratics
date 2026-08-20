// @vitest-environment happy-dom

import {act} from "react";
import {createRoot} from "react-dom/client";
import {afterEach, beforeEach, describe, expect, it, vi} from "vitest";

import {GameShell} from "../components/game/game-shell";

(globalThis as typeof globalThis & {IS_REACT_ACT_ENVIRONMENT?: boolean}).IS_REACT_ACT_ENVIRONMENT = true;

vi.mock("@/lib/supabase/client", () => ({
  createClient: () => ({
    auth: {
      getSession: async () => ({data: {session: {access_token: "token"}}})
    }
  })
}));

vi.mock("@/lib/game/progress-client", () => ({
  getGameProgress: async () => ({selectedFighterId: "captain-falcon", lessons: []}),
  updateGameProgress: vi.fn(async ({request}) => ({
    selectedFighterId: request.selectedFighterId ?? "captain-falcon",
    lessons: request.lessonId ? [{lessonId: request.lessonId, status: request.action === "complete_lesson" ? "completed" : "started"}] : []
  })),
  resetGameProgress: async () => ({selectedFighterId: null, lessons: []})
}));

class FakeAudio {
  currentTime = 0;
  preload = "";
  volume = 1;
  constructor(public src: string) {}
  pause() {}
  play() {
    return Promise.resolve();
  }
}

describe("GameShell", () => {
  let container: HTMLDivElement | null = null;

  beforeEach(() => {
    vi.stubGlobal("Audio", FakeAudio);
    vi.stubGlobal("requestAnimationFrame", vi.fn(() => 1));
    vi.stubGlobal("cancelAnimationFrame", vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    container?.remove();
    container = null;
  });

  it("prompts signed-out users to login when selecting a fighter", async () => {
    container = document.createElement("div");
    document.body.append(container);
    const root = createRoot(container);

    await act(async () => {
      root.render(<GameShell initialUser={null} />);
    });

    const luigi = Array.from(container.querySelectorAll("button")).find((button) => button.textContent?.includes("Luigi"));
    await act(async () => {
      luigi?.dispatchEvent(new MouseEvent("click", {bubbles: true}));
    });

    expect(container.textContent).toContain("Login required");

    await act(async () => {
      root.unmount();
    });
  });

  it("opens the arena for signed-in users", async () => {
    container = document.createElement("div");
    document.body.append(container);
    const root = createRoot(container);

    await act(async () => {
      root.render(<GameShell initialUser={{id: "1", email: "student@example.com", displayName: null, creditBalance: 0}} />);
    });

    const start = Array.from(container.querySelectorAll("button")).find((button) => button.textContent?.includes("Press Space"));
    await act(async () => {
      start?.dispatchEvent(new MouseEvent("click", {bubbles: true}));
    });

    expect(container.textContent).toContain("WASD or arrows");

    await act(async () => {
      root.unmount();
    });
  });

  it("shows the locked lesson message without opening the PDF", async () => {
    container = document.createElement("div");
    document.body.append(container);
    const root = createRoot(container);

    await act(async () => {
      root.render(<GameShell initialUser={{id: "1", email: "student@example.com", displayName: null, creditBalance: 0}} />);
    });
    const start = Array.from(container.querySelectorAll("button")).find((button) => button.textContent?.includes("Press Space"));
    await act(async () => {
      start?.dispatchEvent(new MouseEvent("click", {bubbles: true}));
    });
    const locked = Array.from(container.querySelectorAll("button")).find((button) => button.textContent?.includes("Check locked lesson"));
    await act(async () => {
      locked?.dispatchEvent(new MouseEvent("click", {bubbles: true}));
    });

    expect(container.textContent).toContain("Locked lesson");
    expect(container.querySelector("object[type='application/pdf']")).toBeNull();

    await act(async () => {
      root.unmount();
    });
  });
});
