export function normalizeEquationInput(input: string): string {
  const normalized = input
    .trim()
    .replace(/\u2212/g, "-")
    .replace(/\\left|\\right/g, "")
    .replace(/\\cdot|\\times/g, "*")
    .replace(/\\frac\{([^{}]+)\}\{([^{}]+)\}/g, "($1)/($2)")
    .replace(/\^\{([^{}]+)\}/g, "^$1")
    .replace(/\s+/g, " ")
    .replace(/(\d)([a-zA-Z])/g, "$1*$2")
    .replace(/(\d)\(/g, "$1*(")
    .replace(/\)([a-zA-Z])/g, ")*$1")
    .replace(/([a-zA-Z])\(/g, "$1*(")
    .replace(/\)\(/g, ")*(");

  const formatted = formatEquationOperators(normalized);
  if (formatted && !formatted.includes("=")) {
    return `${formatted} = 0`;
  }
  return formatted;
}

function formatEquationOperators(input: string): string {
  return input
    .replace(/\s*=\s*/g, " = ")
    .replace(/\s*\+\s*/g, " + ")
    .replace(/\s*-\s*/g, " - ")
    .replace(/^\s*-\s/, "-")
    .replace(/\s{2,}/g, " ")
    .trim();
}
