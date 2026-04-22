export interface StockProfitInput {
  quantity: number;
  unitCost: number;
  retailPrice?: number | null;
  wholesalePrice?: number | null;
}

export interface StockProfitLine {
  sellingPrice: number;
  profitPerUnit: number;
  totalProfit: number;
  marginPercent: number;
  isLoss: boolean;
}

export interface StockProfitPreview {
  retail?: StockProfitLine;
  wholesale?: StockProfitLine;
  hasValidSellingPrice: boolean;
  hasLoss: boolean;
  lossMessages: string[];
}

function toFiniteNumber(value: number | null | undefined): number {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : 0;
}

function roundToTwo(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

function buildProfitLine(price: number, quantity: number, unitCost: number): StockProfitLine | undefined {
  if (price <= 0) return undefined;

  const profitPerUnit = price - unitCost;

  return {
    sellingPrice: price,
    profitPerUnit: roundToTwo(profitPerUnit),
    totalProfit: roundToTwo(profitPerUnit * quantity),
    marginPercent: roundToTwo((profitPerUnit / price) * 100),
    isLoss: profitPerUnit < 0,
  };
}

export function calculateStockProfitPreview(input: StockProfitInput): StockProfitPreview {
  const quantity = Math.max(0, toFiniteNumber(input.quantity));
  const unitCost = Math.max(0, toFiniteNumber(input.unitCost));
  const retail = buildProfitLine(toFiniteNumber(input.retailPrice), quantity, unitCost);
  const wholesale = buildProfitLine(toFiniteNumber(input.wholesalePrice), quantity, unitCost);
  const hasValidSellingPrice = Boolean(retail || wholesale);
  const lossMessages: string[] = [];

  if (!hasValidSellingPrice) {
    lossMessages.push("Set a retail or wholesale selling price before adding stock.");
  }
  if (retail?.isLoss) {
    lossMessages.push("Unit cost is higher than retail selling price. This stock would sell at a loss.");
  }
  if (wholesale?.isLoss) {
    lossMessages.push("Unit cost is higher than wholesale selling price. This stock would sell at a loss.");
  }

  return {
    retail,
    wholesale,
    hasValidSellingPrice,
    hasLoss: lossMessages.length > 0,
    lossMessages,
  };
}
