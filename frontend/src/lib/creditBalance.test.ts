import assert from "node:assert/strict";
import { buildVisibleCreditSummary } from "./creditBalance";

assert.deepEqual(
  buildVisibleCreditSummary(null, 0),
  { totalOutstanding: 0, openEntries: 0, overdueCount: 0 }
);

assert.deepEqual(
  buildVisibleCreditSummary(
    { totalOutstanding: 1500, openEntries: 2, overdueCount: 1 },
    500
  ),
  { totalOutstanding: 2000, openEntries: 3, overdueCount: 1 }
);

assert.deepEqual(
  buildVisibleCreditSummary(
    { totalOutstanding: 1500, openEntries: 2, overdueCount: 0 },
    0
  ),
  { totalOutstanding: 1500, openEntries: 2, overdueCount: 0 }
);

console.log("creditBalance tests passed");
