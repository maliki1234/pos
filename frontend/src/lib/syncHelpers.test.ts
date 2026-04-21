import assert from "node:assert/strict";
import { calculateAvailableQuantity, sortSyncQueueItems } from "./syncHelpers";

const unordered: Array<{ id: string; type: "CATEGORY" | "CUSTOMER" | "PRODUCT" | "STOCK" | "TRANSACTION"; createdAt: number }> = [
  { id: "txn", type: "TRANSACTION", createdAt: 30 },
  { id: "stock", type: "STOCK", createdAt: 20 },
  { id: "product-newer", type: "PRODUCT", createdAt: 15 },
  { id: "category", type: "CATEGORY", createdAt: 10 },
  { id: "customer", type: "CUSTOMER", createdAt: 5 },
  { id: "product-older", type: "PRODUCT", createdAt: 1 },
];

assert.deepEqual(
  sortSyncQueueItems(unordered).map((item) => item.id),
  ["category", "customer", "product-older", "product-newer", "stock", "txn"]
);

assert.equal(
  calculateAvailableQuantity({
    baseQuantity: 10,
    pendingStockQuantity: 5,
    pendingTransactionQuantity: 3,
  }),
  12
);

assert.equal(
  calculateAvailableQuantity({
    baseQuantity: 2,
    pendingStockQuantity: 0,
    pendingTransactionQuantity: 5,
  }),
  0
);

console.log("syncHelpers tests passed");
