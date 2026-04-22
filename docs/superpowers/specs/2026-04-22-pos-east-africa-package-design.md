# East Africa POS Core Package Design

**Goal:** Strengthen the POS around the East Africa buying criteria: visible profit, clear customer credit balances, safe product/stock deletion, and transparent offline sync.

**Scope:**
- Reports must always show a profit summary for the selected period, including zero values and fetch errors.
- Credit sales must refresh and display the selected customer's outstanding balance after checkout.
- Product and stock deletion must be soft-delete/archive behavior so historical transactions remain valid.
- Offline sync status must be visible enough for staff/admins to understand pending and failed local work.

**Design:**
- Keep historical records intact by setting `isActive=false` on products and stock batches.
- Product archive also deactivates active stock batches for that product.
- Frontend stores remove archived items from local state and IndexedDB after successful API calls.
- Reports use a default zero profit summary instead of hiding the section when the API fails or returns no sales.
- Cashier calculates a visible credit balance from server summary plus the current credit sale immediately after submit.

**Testing:**
- Add small node/assert tests for pure helpers that control visible profit and visible credit summary behavior.
- Run frontend helper tests, backend type-check/build, and frontend type-check/build before commit.
