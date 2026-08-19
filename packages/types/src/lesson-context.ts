export type RealWorldContextStatus = "completed" | "unsupported" | "failed";

export interface RealWorldContext {
  status: RealWorldContextStatus;
  title: string;
  scenario: string;
  takeaway: string;
  unsupportedReason?: string | null;
  providerMetadata?: Record<string, unknown>;
}
