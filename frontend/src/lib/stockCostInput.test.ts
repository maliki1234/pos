import assert from "node:assert/strict";
import { calculateStockUnitCost } from "./stockCostInput";

assert.equal(
  calculateStockUnitCost({
    mode: "unit",
    quantity: 10,
    unitCost: 850,
    totalCost: 9000,
  }),
  850
);

assert.equal(
  calculateStockUnitCost({
    mode: "total",
    quantity: 10,
    unitCost: 850,
    totalCost: 9000,
  }),
  900
);

assert.equal(
  calculateStockUnitCost({
    mode: "total",
    quantity: 3,
    totalCost: 1000,
  }),
  333.33
);

assert.equal(
  calculateStockUnitCost({
    mode: "total",
    quantity: 0,
    totalCost: 1000,
  }),
  0
);

console.log("stockCostInput tests passed");
