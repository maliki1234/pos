import assert from "node:assert/strict";
import { mapProfitRow } from "../src/services/analyticsProfit";

assert.deepEqual(
  mapProfitRow({
    productId: 1,
    name: "Cooking Oil",
    quantitySold: 2,
    totalRevenue: 20,
    stockAverageCost: 6,
    priceCost: 10,
  }),
  {
    productId: 1,
    name: "Cooking Oil",
    revenue: 20,
    cost: 12,
    profit: 8,
    marginPct: 40,
  }
);

assert.deepEqual(
  mapProfitRow({
    productId: 2,
    name: "Rice",
    quantitySold: 3,
    totalRevenue: 30,
    stockAverageCost: null,
    priceCost: 7,
  }),
  {
    productId: 2,
    name: "Rice",
    revenue: 30,
    cost: 21,
    profit: 9,
    marginPct: 30,
  }
);

console.log("analyticsProfit tests passed");
