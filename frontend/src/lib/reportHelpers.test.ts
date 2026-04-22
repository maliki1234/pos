import assert from "node:assert/strict";
import { getVisibleProfitSummary, ZERO_PROFIT_SUMMARY } from "./reportHelpers";

assert.deepEqual(getVisibleProfitSummary(null), ZERO_PROFIT_SUMMARY);

assert.equal(
  getVisibleProfitSummary({
    revenue: 1000,
    productCost: 650,
    grossProfit: 350,
    runningCosts: 120,
    netProfit: 230,
    grossMarginPct: 35,
    netMarginPct: 23,
  }).netProfit,
  230
);

console.log("reportHelpers tests passed");
