import {describe, expect, it} from "vitest";

import {equationSubmitErrorMessage} from "../lib/equation-errors";

describe("equationSubmitErrorMessage", () => {
  it("preserves signed-out failures as auth guidance", () => {
    expect(equationSubmitErrorMessage("Sign in to run an equation.")).toBe("Log in to run equations.");
  });

  it("uses the friendly quadratic validation message for solver failures", () => {
    expect(equationSubmitErrorMessage("Equation contains unsupported characters")).toBe(
      "This is not a valid quadratic equation."
    );
  });
});
