import type {Lesson} from "./lesson";
import type {NarrationEquationRequest, NarrationEquationResponse, ScriptEquationRequest, ScriptEquationResponse} from "./script";
import type {CurrentUser} from "./usage";

export interface SolveEquationRequest {
  equation: string;
  instructorId?: string | null;
}

export type SolveEquationResponse = Lesson;

export type {NarrationEquationRequest, NarrationEquationResponse, ScriptEquationRequest, ScriptEquationResponse};

export interface MeResponse extends CurrentUser {}
