import type {TeachingStep} from "@quadratics/types";

export const sampleStep: TeachingStep = {
  id: "solve_factors",
  title: "Solve each factor",
  stepType: "solve_factors",
  mathLines: [
    {id: "first_factor", expression: "2*x - 1 = 0", latex: "2 x - 1 = 0"},
    {id: "first_solution", expression: "x = 1/2", latex: "x = \\frac{1}{2}"},
    {id: "second_factor", expression: "x - 3 = 0", latex: "x - 3 = 0"},
    {id: "second_solution", expression: "x = 3", latex: "x = 3"}
  ]
};
