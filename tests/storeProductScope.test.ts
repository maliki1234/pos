import assert from "node:assert/strict";
import { buildProductWhere } from "../src/services/productScope";

assert.deepEqual(
  buildProductWhere("business-1", "store-a"),
  { businessId: "business-1", storeId: "store-a", isActive: true }
);

assert.deepEqual(
  buildProductWhere("business-1", "store-a", { search: "rice", categoryId: "cat-1" }),
  {
    businessId: "business-1",
    storeId: "store-a",
    isActive: true,
    categoryId: "cat-1",
    OR: [
      { name: { contains: "rice", mode: "insensitive" } },
      { barcode: { contains: "rice", mode: "insensitive" } },
    ],
  }
);

console.log("storeProductScope tests passed");
