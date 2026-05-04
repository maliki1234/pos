import assert from "node:assert/strict";
import { buildStockBatchWhere } from "../src/services/stockService";

assert.deepEqual(
  buildStockBatchWhere("business-1", undefined, "store-a"),
  { isActive: true, product: { businessId: "business-1" }, storeId: "store-a" }
);

assert.deepEqual(
  buildStockBatchWhere("business-1", 42, "store-a"),
  { isActive: true, productId: 42, product: { businessId: "business-1" }, storeId: "store-a" }
);

console.log("storeStockScope tests passed");
