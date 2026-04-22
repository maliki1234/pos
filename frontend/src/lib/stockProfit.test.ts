import assert from "node:assert/strict";
import { calculateStockProfitPreview } from "./stockProfit";

const profitable = calculateStockProfitPreview({
  quantity: 10,
  unitCost: 900,
  retailPrice: 1500,
  wholesalePrice: 1200,
});

assert.equal(profitable.retail?.profitPerUnit, 600);
assert.equal(profitable.retail?.totalProfit, 6000);
assert.equal(profitable.retail?.marginPercent, 40);
assert.equal(profitable.wholesale?.profitPerUnit, 300);
assert.equal(profitable.wholesale?.totalProfit, 3000);
assert.equal(profitable.wholesale?.marginPercent, 25);
assert.equal(profitable.hasLoss, false);
assert.deepEqual(profitable.lossMessages, []);

const wholesaleLoss = calculateStockProfitPreview({
  quantity: 5,
  unitCost: 900,
  retailPrice: 1500,
  wholesalePrice: 800,
});

assert.equal(wholesaleLoss.hasLoss, true);
assert.equal(wholesaleLoss.retail?.isLoss, false);
assert.equal(wholesaleLoss.wholesale?.isLoss, true);
assert.equal(
  wholesaleLoss.lossMessages[0],
  "Unit cost is higher than wholesale selling price. This stock would sell at a loss."
);

const missingPrices = calculateStockProfitPreview({
  quantity: 3,
  unitCost: 500,
  retailPrice: 0,
  wholesalePrice: 0,
});

assert.equal(missingPrices.hasValidSellingPrice, false);
assert.equal(missingPrices.hasLoss, true);
assert.equal(missingPrices.lossMessages[0], "Set a retail or wholesale selling price before adding stock.");

console.log("stockProfit tests passed");
