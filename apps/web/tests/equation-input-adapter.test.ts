import {describe, expect, it} from "vitest";

import {normalizeEquationInput} from "../lib/equation-input";

describe("normalizeEquationInput", () => {
  it("adds explicit multiplication around coefficients and x", () => {
    expect(normalizeEquationInput("2x^2 - 7x + 3 = 0")).toBe("2*x^2 - 7*x + 3 = 0");
    expect(normalizeEquationInput("2(x-1)(x-3)=0")).toBe("2*(x - 1)*(x - 3) = 0");
  });

  it("treats a bare quadratic expression as equal to zero", () => {
    expect(normalizeEquationInput("2x^2 - 7x + 3")).toBe("2*x^2 - 7*x + 3 = 0");
  });

  it("preserves already explicit quadratic input", () => {
    expect(normalizeEquationInput("2*x^2 - 7*x + 3 = 0")).toBe("2*x^2 - 7*x + 3 = 0");
  });

  it("normalizes common MathLive LaTeX export shapes", () => {
    expect(normalizeEquationInput("2x^{2}-7x+3=0")).toBe("2*x^2 - 7*x + 3 = 0");
    expect(normalizeEquationInput("\\frac{1}{2}x^2+x=0")).toBe("(1)/(2)*x^2 + x = 0");
  });

  it("preserves grouping for compound MathLive fractions", () => {
    expect(normalizeEquationInput("\\frac{x^2+3x+2}{2}=0")).toBe("(x^2 + 3*x + 2)/(2) = 0");
  });

  it("keeps unsupported forms visible to API validation", () => {
    expect(normalizeEquationInput("2y^2 + 1 = 0")).toBe("2*y^2 + 1 = 0");
    expect(normalizeEquationInput("hello world")).toBe("hello world = 0");
    expect(normalizeEquationInput("x^3 + 1 = 0")).toBe("x^3 + 1 = 0");
  });
});
