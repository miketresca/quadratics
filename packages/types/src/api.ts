import type {GenerationSnapshot} from "./generation";
import type {Lesson} from "./lesson";
import type {NarrationEquationRequest, NarrationEquationResponse, ScriptEquationRequest, ScriptEquationResponse} from "./script";
import type {CurrentUser} from "./usage";

export interface SolveEquationRequest {
  equation: string;
  instructorId?: string | null;
}

export type SolveEquationResponse = Lesson;
export type CreateGenerationResponse = GenerationSnapshot;
export type GetGenerationResponse = GenerationSnapshot;

export type {NarrationEquationRequest, NarrationEquationResponse, ScriptEquationRequest, ScriptEquationResponse};

export interface MeResponse extends CurrentUser {}
