export interface CreditSummary {
  totalOutstanding: number;
  openEntries: number;
  overdueCount: number;
}

const ZERO_CREDIT_SUMMARY: CreditSummary = {
  totalOutstanding: 0,
  openEntries: 0,
  overdueCount: 0,
};

export function buildVisibleCreditSummary(
  summary: CreditSummary | null | undefined,
  pendingCreditSaleAmount: number
): CreditSummary {
  const base = summary ?? ZERO_CREDIT_SUMMARY;
  const pendingAmount = Math.max(0, Number(pendingCreditSaleAmount) || 0);

  return {
    totalOutstanding: Number(base.totalOutstanding || 0) + pendingAmount,
    openEntries: Number(base.openEntries || 0) + (pendingAmount > 0 ? 1 : 0),
    overdueCount: Number(base.overdueCount || 0),
  };
}
