import type {Lesson} from "./lesson";
import type {CurrentUser} from "./usage";

export interface SolveEquationRequest {
  equation: string;
  instructorId?: string | null;
}

export type SolveEquationResponse = Lesson;

export interface MeResponse extends CurrentUser {}
