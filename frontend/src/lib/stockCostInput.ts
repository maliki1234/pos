export type StockCostInputMode = "unit" | "total";

export interface StockCostInput {
  mode: StockCostInputMode;
  quantity: number;
  unitCost?: number;
  totalCost?: number;
}

function toFiniteNumber(value: number | null | undefined): number {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : 0;
}

function roundCurrency(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

export function calculateStockUnitCost(input: StockCostInput): number {
  const quantity = toFiniteNumber(input.quantity);

  if (input.mode === "total") {
    if (quantity <= 0) return 0;
    return roundCurrency(toFiniteNumber(input.totalCost) / quantity);
  }

  return roundCurrency(toFiniteNumber(input.unitCost));
}
