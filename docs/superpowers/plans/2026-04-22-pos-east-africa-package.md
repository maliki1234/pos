# East Africa POS Core Package Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the first market-ready package from the East Africa POS research: profit visibility, credit balance visibility, safe archive/delete, and sync transparency.

**Architecture:** Use small frontend helpers for display logic, soft-delete backend routes for product/stock, and existing Zustand/IndexedDB stores for local cache updates. Avoid schema changes and preserve sales history.

**Tech Stack:** Express, TypeScript, Prisma, Next.js, Zustand, Dexie, node/assert smoke tests.

---

### Task 1: Profit Visibility

**Files:**
- Create: `frontend/src/lib/reportHelpers.ts`
- Create: `frontend/src/lib/reportHelpers.test.ts`
- Modify: `frontend/src/stores/useAnalyticsStore.ts`
- Modify: `frontend/src/app/dashboard/reports/page.tsx`

- [x] Write a failing helper test that expects a zero-value profit summary to be visible when the API has not returned one.
- [x] Implement `ZERO_PROFIT_SUMMARY` and `getVisibleProfitSummary`.
- [x] Update the reports page to render the profit summary using the visible summary and show an error line if the fetch fails.

### Task 2: Credit Balance After Credit Sale

**Files:**
- Create: `frontend/src/lib/creditBalance.ts`
- Create: `frontend/src/lib/creditBalance.test.ts`
- Modify: `frontend/src/app/dashboard/cashier/page.tsx`

- [x] Write a failing helper test that expects the displayed balance to include the sale amount immediately after a credit sale.
- [x] Implement `buildVisibleCreditSummary`.
- [x] Refresh customer credit summary after submit and display the current balance even when it is zero.

### Task 3: Product And Stock Archive

**Files:**
- Modify: `src/controllers/productController.ts`
- Modify: `src/routes/productRoutes.ts`
- Modify: `src/controllers/stockController.ts`
- Modify: `src/services/stockService.ts`
- Modify: `src/routes/stockRoutes.ts`
- Modify: `frontend/src/stores/useProductsStore.ts`
- Modify: `frontend/src/stores/useStockStore.ts`
- Modify: `frontend/src/app/dashboard/products/page.tsx`
- Modify: `frontend/src/app/dashboard/stock/page.tsx`

- [x] Add `DELETE /products/:id` for ADMIN/MANAGER that sets product inactive and deactivates active stock batches.
- [x] Add `DELETE /stock/batch/:batchId` for ADMIN/MANAGER that sets one stock batch inactive.
- [x] Add frontend store actions and delete buttons with confirmation.

### Task 4: Sync Transparency

**Files:**
- Modify: `frontend/src/stores/useSyncStore.ts`
- Modify: `frontend/src/app/dashboard/reports/page.tsx`

- [x] Expose pending sync queue items with type/action/error metadata.
- [x] Show a compact sync status panel in reports so failed offline work is not invisible.

### Verification

- [x] Run `.\\node_modules\\.bin\\tsx.cmd frontend/src/lib/reportHelpers.test.ts`.
- [x] Run `.\\node_modules\\.bin\\tsx.cmd frontend/src/lib/creditBalance.test.ts`.
- [x] Run `npm run type-check`.
- [x] Run `npm run build`.
- [x] Run `cd frontend; npm run type-check`.
- [x] Run `cd frontend; npm run build`.
