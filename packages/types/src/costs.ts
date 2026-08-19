export interface UsageBreakdownItem {
  provider: string;
  stage: string;
  unitType: string;
  quantity: number;
  costUsd: number;
}

export interface UsageSummary {
  userTotalCostUsd: number;
  userTotalQuantity: number;
  userBreakdown: UsageBreakdownItem[];
  globalAverageCostPerVideoUsd: number;
  globalVideoCount: number;
  globalBreakdown: UsageBreakdownItem[];
}

export interface UsageEventItem {
  id: string;
  createdAt: string;
  generationJobId?: string | null;
  provider: string;
  stage: string;
  model?: string | null;
  unitType: string;
  quantity: number;
  unitCostUsd: number;
  costUsd: number;
}

export interface UsageEventsResponse {
  events: UsageEventItem[];
}
