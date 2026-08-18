import type {Lesson} from "./lesson";
import type {ScriptEquationRequest, ScriptEquationResponse} from "./script";
import type {CurrentUser} from "./usage";

export interface SolveEquationRequest {
  equation: string;
  instructorId?: string | null;
}

export type SolveEquationResponse = Lesson;

export type {ScriptEquationRequest, ScriptEquationResponse};

export interface MeResponse extends CurrentUser {}
