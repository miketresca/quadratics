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
