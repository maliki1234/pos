type NumericValue = number | string | bigint | { toString(): string } | null | undefined;

export interface ProfitSourceRow {
  productId: number;
  name: string;
  quantitySold: NumericValue;
  totalRevenue: NumericValue;
  stockAverageCost: NumericValue;
  priceCost: NumericValue;
}

function toNumber(value: NumericValue) {
  if (value === null || value === undefined) return 0;
  return Number(value.toString());
}

function roundMoney(value: number) {
  return Math.round(value * 100) / 100;
}

export function mapProfitRow(row: ProfitSourceRow) {
  const revenue = roundMoney(toNumber(row.totalRevenue));
  const quantitySold = toNumber(row.quantitySold);
  const unitCost = row.stockAverageCost !== null && row.stockAverageCost !== undefined
    ? toNumber(row.stockAverageCost)
    : toNumber(row.priceCost);
  const cost = roundMoney(unitCost * quantitySold);
  const profit = roundMoney(revenue - cost);

  return {
    productId: row.productId,
    name: row.name,
    revenue,
    cost,
    profit,
    marginPct: revenue > 0 ? Math.round((profit / revenue) * 100 * 10) / 10 : 0,
  };
}
