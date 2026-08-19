import type {RenderInput} from "../timeline/input";

export const goldenFixtureSlug = "x2-plus-5x-plus-6";

export const goldenFixtureFiles = {
  lesson: "fixtures/golden/x2-plus-5x-plus-6/lesson.json",
  script: "fixtures/golden/x2-plus-5x-plus-6/script.json",
  speechMarkup: "fixtures/golden/x2-plus-5x-plus-6/speech-markup.json",
  narration: "fixtures/golden/x2-plus-5x-plus-6/narration.json"
} as const;

export const goldenRenderInput: RenderInput = {
  lesson: {
    status: "completed",
    originalEquation: "x^2 + 5*x + 6 = 0",
    normalizedEquation: "x**2 + 5*x + 6 = 0",
    method: "factoring",
    coefficients: {
      a: {expression: "1", latex: "1"},
      b: {expression: "5", latex: "5"},
      c: {expression: "6", latex: "6"}
    },
    solutions: [
      {expression: "-3", latex: "-3"},
      {expression: "-2", latex: "-2"}
    ],
    steps: [
      {
        id: "factor",
        title: "Factor the quadratic",
        stepType: "factor",
        mathLines: [
          {id: "standard_form", expression: "x^2 + 5*x + 6 = 0", latex: "x^{2} + 5 x + 6 = 0"},
          {
            id: "factored_form",
            expression: "(x + 2)*(x + 3) = 0",
            latex: "\\left(x + 2\\right) \\left(x + 3\\right) = 0"
          }
        ]
      },
      {
        id: "solve_factors",
        title: "Solve each factor",
        stepType: "solve_factors",
        mathLines: [
          {id: "first_factor", expression: "x + 3 = 0", latex: "x + 3 = 0"},
          {id: "first_solution", expression: "x = -3", latex: "x = -3"},
          {id: "second_factor", expression: "x + 2 = 0", latex: "x + 2 = 0"},
          {id: "second_solution", expression: "x = -2", latex: "x = -2"}
        ]
      },
      {
        id: "final_answer",
        title: "State the final answer",
        stepType: "final_answer",
        mathLines: [{id: "solutions", expression: "x = -3, -2", latex: "x = -3, -2"}]
      }
    ]
  },
  timeline: {
    version: "resolved-animation-timeline/v1",
    narrationArtifactId: "golden-narration",
    durationSeconds: 24,
    cues: [
      {
        cueId: "cue_write_original",
        lessonStepId: "factor",
        mathLineId: "standard_form",
        narration: {
          text: "Start with x squared plus five x plus six equals zero",
          startSeconds: 0,
          endSeconds: 3.6
        },
        animation: {action: "write_math", startSeconds: 0.2, endSeconds: 2.2},
        sfx: {type: "chalk_write", startSeconds: 0.2, endSeconds: 2.2}
      },
      {
        cueId: "cue_write_factored",
        lessonStepId: "factor",
        mathLineId: "factored_form",
        narration: {
          text: "factors into x plus two times x plus three",
          startSeconds: 7.2,
          endSeconds: 9.8
        },
        animation: {action: "write_math", startSeconds: 7.2, endSeconds: 9.8},
        sfx: {type: "chalk_write", startSeconds: 7.2, endSeconds: 9.8}
      },
      {
        cueId: "cue_highlight_factors",
        lessonStepId: "factor",
        mathLineId: "factored_form",
        narration: {
          text: "two and three",
          startSeconds: 5.2,
          endSeconds: 6.1
        },
        animation: {action: "highlight", startSeconds: 5.2, endSeconds: 6.1}
      },
      {
        cueId: "cue_write_first_solution",
        lessonStepId: "solve_factors",
        mathLineId: "first_solution",
        narration: {
          text: "x plus three equals zero gives x equals negative three",
          startSeconds: 12,
          endSeconds: 15
        },
        animation: {action: "write_math", startSeconds: 12, endSeconds: 14.2},
        sfx: {type: "chalk_write", startSeconds: 12, endSeconds: 14.2}
      },
      {
        cueId: "cue_write_second_solution",
        lessonStepId: "solve_factors",
        mathLineId: "second_solution",
        narration: {
          text: "x plus two equals zero gives x equals negative two",
          startSeconds: 15.2,
          endSeconds: 18
        },
        animation: {action: "write_math", startSeconds: 15.2, endSeconds: 17.4},
        sfx: {type: "chalk_write", startSeconds: 15.2, endSeconds: 17.4}
      },
      {
        cueId: "cue_box_answer",
        lessonStepId: "final_answer",
        mathLineId: "solutions",
        narration: {
          text: "solutions are negative three and negative two",
          startSeconds: 20,
          endSeconds: 23
        },
        animation: {action: "box", startSeconds: 22.4, endSeconds: 23.4}
      }
    ]
  }
};
