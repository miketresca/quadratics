export type InstructorId = string;

export interface Instructor {
  id: InstructorId;
  displayName: string;
  voiceProvider?: string;
  voiceId?: string;
  referenceImageUrl?: string | null;
  imageZoom?: number;
  imageX?: number;
  imageY?: number;
  avatarProvider?: string;
  avatarId?: string;
}
