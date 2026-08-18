export type SolutionMethod =
  | "factoring"
  | "square_root"
  | "completing_the_square"
  | "quadratic_formula";

export type LessonStatus = "completed" | "unsupported_instructional_method";

export interface MathValue {
  expression: string;
  latex: string;
}

export interface QuadraticCoefficients {
  a: MathValue;
  b: MathValue;
  c: MathValue;
}

export interface MathLine {
  id: string;
  expression: string;
  latex: string;
}

export interface TeachingStep {
  id: string;
  title: string;
  stepType: string;
  mathLines: MathLine[];
}

export interface Lesson {
  status: LessonStatus;
  originalEquation: string;
  normalizedEquation: string;
  method: SolutionMethod | null;
  coefficients: QuadraticCoefficients;
  solutions: MathValue[];
  steps: TeachingStep[];
  unsupportedReason?: string;
}
