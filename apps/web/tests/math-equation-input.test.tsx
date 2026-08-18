// @vitest-environment happy-dom

import {act} from "react";
import {useState} from "react";
import {createRoot} from "react-dom/client";
import {afterEach, describe, expect, it, vi} from "vitest";

import {MathEquationInput} from "../components/math-equation-input";

(globalThis as typeof globalThis & {IS_REACT_ACT_ENVIRONMENT?: boolean}).IS_REACT_ACT_ENVIRONMENT = true;

vi.mock("mathlive", () => ({}));

describe("MathEquationInput", () => {
  let container: HTMLDivElement | null = null;

  afterEach(() => {
    container?.remove();
    container = null;
  });

  it("renders the plain placeholder and submit value", async () => {
    const onEquationChange = vi.fn();
    container = document.createElement("div");
    document.body.append(container);
    const root = createRoot(container);

    await act(async () => {
      root.render(<MathEquationInput value="" disabled={false} onEquationChange={onEquationChange} />);
    });

    await act(async () => {
      await Promise.resolve();
    });

    const mathfield = container.querySelector("math-field");
    const hiddenInput = container.querySelector("input[name='equation']");

    expect(mathfield?.getAttribute("aria-label")).toBe("Equation");
    expect(mathfield?.getAttribute("placeholder")).toBe("");
    expect(mathfield?.getAttribute("math-virtual-keyboard-policy")).toBe("manual");
    expect((mathfield as typeof mathfield & {mathVirtualKeyboardPolicy?: string})?.mathVirtualKeyboardPolicy).toBe(
      "manual"
    );
    expect((mathfield as typeof mathfield & {menuItems?: unknown[]})?.menuItems).toEqual([]);
    expect(container.textContent).toContain("Enter a quadratic equation");
    expect(hiddenInput?.getAttribute("aria-hidden")).toBe("true");
    expect((hiddenInput as HTMLInputElement | null)?.value).toBe("");

    await act(async () => {
      root.unmount();
    });
  });

  it("marks the math field read-only when disabled", async () => {
    const onEquationChange = vi.fn();
    container = document.createElement("div");
    document.body.append(container);
    const root = createRoot(container);

    await act(async () => {
      root.render(<MathEquationInput value="2x^2" disabled={true} onEquationChange={onEquationChange} />);
    });

    await act(async () => {
      await Promise.resolve();
    });

    const mathfield = container.querySelector("math-field");

    expect(mathfield?.getAttribute("read-only")).toBe("");
    expect(mathfield?.getAttribute("tabindex")).toBe("-1");

    await act(async () => {
      root.unmount();
    });
  });

  it("emits normalized submit text from MathLive input", async () => {
    const onEquationChange = vi.fn();
    container = document.createElement("div");
    document.body.append(container);
    const root = createRoot(container);

    await act(async () => {
      root.render(<MathEquationInput value="" disabled={false} onEquationChange={onEquationChange} />);
    });

    await act(async () => {
      await Promise.resolve();
    });

    const mathfield = container.querySelector("math-field") as HTMLElement & {
      getValue?: (format?: string) => string;
    };
    mathfield.getValue = () => "2x^{2}-7x+3=0";

    await act(async () => {
      mathfield.dispatchEvent(new Event("input", {bubbles: true}));
    });

    expect(onEquationChange).toHaveBeenCalledWith("2x^{2}-7x+3=0", "2*x^2 - 7*x + 3 = 0");

    await act(async () => {
      root.unmount();
    });
  });

  it("updates the hidden form field with normalized input", async () => {
    function TestForm() {
      const [equation, setEquation] = useState("");
      return (
        <form>
          <MathEquationInput value={equation} disabled={false} onEquationChange={(visible) => setEquation(visible)} />
        </form>
      );
    }

    container = document.createElement("div");
    document.body.append(container);
    const root = createRoot(container);

    await act(async () => {
      root.render(<TestForm />);
    });

    await act(async () => {
      await Promise.resolve();
    });

    const mathfield = container.querySelector("math-field") as HTMLElement & {
      getValue?: (format?: string) => string;
    };
    mathfield.getValue = () => "2x^{2}-7x+3=0";

    await act(async () => {
      mathfield.dispatchEvent(new Event("input", {bubbles: true}));
    });

    const hiddenInput = container.querySelector("input[name='equation']");
    expect((hiddenInput as HTMLInputElement | null)?.value).toBe("2*x^2 - 7*x + 3 = 0");

    await act(async () => {
      root.unmount();
    });
  });
});
