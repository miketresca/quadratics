export type InstructorId = "male" | "female";

export interface Instructor {
  id: InstructorId;
  displayName: string;
  voiceProvider?: string;
  voiceId?: string;
  avatarProvider?: string;
  avatarId?: string;
}
