export interface StockSellingPrice {
  customerType: string;
  unitPrice: unknown;
  isActive?: boolean | null;
}

export interface StockProfitValidationInput {
  unitCost: number;
  prices: StockSellingPrice[];
}

export interface StockProfitValidationResult {
  hasValidSellingPrice: boolean;
  hasLoss: boolean;
  lossMessages: string[];
}

function toFiniteNumber(value: unknown): number {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : 0;
}

export function getStockProfitValidation(input: StockProfitValidationInput): StockProfitValidationResult {
  const unitCost = Math.max(0, toFiniteNumber(input.unitCost));
  const activeSellingPrices = input.prices
    .filter((price) => price.isActive !== false)
    .filter((price) => price.customerType === "RETAIL" || price.customerType === "WHOLESALE")
    .map((price) => ({
      customerType: price.customerType,
      unitPrice: toFiniteNumber(price.unitPrice),
    }))
    .filter((price) => price.unitPrice > 0);
  const hasValidSellingPrice = activeSellingPrices.length > 0;
  const hasRetailLoss = activeSellingPrices.some(
    (price) => price.customerType === "RETAIL" && price.unitPrice < unitCost
  );
  const hasWholesaleLoss = activeSellingPrices.some(
    (price) => price.customerType === "WHOLESALE" && price.unitPrice < unitCost
  );
  const lossMessages: string[] = [];

  if (!hasValidSellingPrice) {
    lossMessages.push("Set a retail or wholesale selling price before adding stock.");
  }
  if (hasRetailLoss) {
    lossMessages.push("Unit cost is higher than retail selling price. This stock would sell at a loss.");
  }
  if (hasWholesaleLoss) {
    lossMessages.push("Unit cost is higher than wholesale selling price. This stock would sell at a loss.");
  }

  return {
    hasValidSellingPrice,
    hasLoss: lossMessages.length > 0,
    lossMessages,
  };
}
