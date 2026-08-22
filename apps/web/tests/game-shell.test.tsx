// @vitest-environment happy-dom

import {act} from "react";
import {createRoot} from "react-dom/client";
import {afterEach, describe, expect, it} from "vitest";

import {GameShell} from "../components/game/game-shell";

(globalThis as typeof globalThis & {IS_REACT_ACT_ENVIRONMENT?: boolean}).IS_REACT_ACT_ENVIRONMENT = true;

describe("GameShell", () => {
  let container: HTMLDivElement | null = null;

  afterEach(() => {
    container?.remove();
    container = null;
  });

  it("renders the full-screen worksheet POV shell without the shared app header", async () => {
    container = document.createElement("div");
    document.body.append(container);
    const root = createRoot(container);

    await act(async () => {
      root.render(<GameShell initialLoginError={null} initialUser={null} />);
    });

    expect(container.textContent).toContain("Press Space To Start");
    expect(container.textContent).toContain("Space");
    expect(container.textContent).toContain("Esc");
    expect(container.textContent).not.toContain("API keys");
    expect(container.textContent).not.toContain("Quadratics Game Lab");

    await act(async () => {
      root.unmount();
    });
  });
});
