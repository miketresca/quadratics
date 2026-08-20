const invalidQuadraticMessage = "This is not a valid quadratic equation.";
const signedOutMessage = "Sign in to run equations.";

// Keeps auth failures from being presented as math validation failures.
export function equationSubmitErrorMessage(message: string) {
  if (/\bsign in\b/i.test(message)) {
    return signedOutMessage;
  }
  return invalidQuadraticMessage;
}
