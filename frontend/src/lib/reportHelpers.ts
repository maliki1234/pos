export interface ProfitSummary {
  revenue: number;
  productCost: number;
  grossProfit: number;
  runningCosts: number;
  netProfit: number;
  grossMarginPct: number;
  netMarginPct: number;
}

export const ZERO_PROFIT_SUMMARY: ProfitSummary = {
  revenue: 0,
  productCost: 0,
  grossProfit: 0,
  runningCosts: 0,
  netProfit: 0,
  grossMarginPct: 0,
  netMarginPct: 0,
};

export function getVisibleProfitSummary(summary: ProfitSummary | null | undefined) {
  return summary ?? ZERO_PROFIT_SUMMARY;
}
