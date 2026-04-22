import assert from "node:assert/strict";
import { getStockProfitValidation } from "../src/services/stockProfitValidation";

const profitable = getStockProfitValidation({
  unitCost: 900,
  prices: [
    { customerType: "RETAIL", unitPrice: 1500, isActive: true },
    { customerType: "WHOLESALE", unitPrice: 1200, isActive: true },
  ],
});

assert.equal(profitable.hasLoss, false);
assert.deepEqual(profitable.lossMessages, []);

const wholesaleLoss = getStockProfitValidation({
  unitCost: 900,
  prices: [
    { customerType: "RETAIL", unitPrice: 1500, isActive: true },
    { customerType: "WHOLESALE", unitPrice: 800, isActive: true },
  ],
});

assert.equal(wholesaleLoss.hasLoss, true);
assert.equal(
  wholesaleLoss.lossMessages[0],
  "Unit cost is higher than wholesale selling price. This stock would sell at a loss."
);

const missingPrices = getStockProfitValidation({
  unitCost: 500,
  prices: [],
});

assert.equal(missingPrices.hasValidSellingPrice, false);
assert.equal(missingPrices.hasLoss, true);
assert.equal(missingPrices.lossMessages[0], "Set a retail or wholesale selling price before adding stock.");

console.log("stockProfitValidation tests passed");
