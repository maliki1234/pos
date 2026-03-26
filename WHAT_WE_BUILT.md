# POS System — What We Built

## Overview
A full multi-tenant Point of Sale (POS) system built for Tanzania, with offline support, payment integrations, and advanced inventory management.

---

## 1. Core POS (Cashier)
- Search and add products to cart
- Retail and wholesale pricing modes
- Customer search and selection
- Loyalty points redemption
- Real-time stock check (out-of-stock blocked)
- Receipt with print, download, and WhatsApp sharing

---

## 2. Products & Inventory
- Add/edit/delete products with cost price and selling price
- Categories for organizing products
- Stock management with batch tracking (FIFO)
- Stock history and batch numbers
- Profit margin tracking (cost price vs selling price)

---

## 3. Product Hierarchy (Carton → Block → Piece)
- Products can be linked as parent/child (e.g. Carton → Block → Piece)
- Convert stock: break a carton into blocks or pieces
- Cost automatically distributed to child units
- Profit simulation: see expected profit at different selling prices
- Conversion history tracked

---

## 4. Recipes / BOM (Bakery & Manufacturing)
- Create recipes with multiple ingredients and quantities
- Run production: deducts ingredients from stock automatically
- Add extra costs (labor, electricity, packaging)
- Finished product added to stock with calculated cost
- Production history

---

## 5. Barcode Generation
- Auto-generate CODE128 barcodes for any product
- Live preview before printing
- Bulk select and print multiple labels
- Configurable number of copies per product

---

## 6. Payments
### Cash
- Change calculator (enter amount received → shows change)
- Split payment (Cash + Mobile Money)

### M-Pesa (Kenya)
- STK Push — customer receives prompt on phone
- Auto-polls for confirmation
- Manual reference fallback (offline mode)

### Azampay (Tanzania)
- Covers M-Pesa TZ, Airtel, Tigo, Halopesa in one integration
- Auto-detects network from phone number prefix
- Sends payment prompt to customer phone
- Reference saved on transaction

### Other Methods
- Card (with reference number)
- Bank Transfer
- Cheque
- Credit (buy now pay later)

---

## 7. Credit (Buy Now Pay Later)
- Sell on credit to customers
- Set due dates
- Track outstanding balances per customer
- Overdue alerts at point of sale
- Credit limit warnings

---

## 8. Customers & Loyalty
- Customer profiles (name, phone, email)
- Loyalty points earned on every purchase
- Points redemption at checkout
- Tier system (Bronze, Silver, Gold)
- Customer purchase history

---

## 9. Settings
- Business name, phone, email, address
- Default currency (Tanzanian Shilling TZS)
- KRA eTIMS (Kenya tax compliance) — optional
- M-Pesa Daraja configuration
- Azampay Tanzania configuration

---

## 10. Reports & Analytics
- Daily/weekly/monthly sales overview
- Top selling products
- Revenue trends
- Transaction history with filters

---

## 11. Staff Management
- Multiple staff accounts per business
- Roles: Admin, Manager, Cashier
- Each staff logs in separately

---

## 12. Multi-Store Support
- One business can have multiple store locations
- Inventory tracked per store
- Cashier can switch between stores

---

## 13. Offline Mode
- Works without internet (offline-first)
- Sales saved locally (IndexedDB)
- Auto-syncs when back online
- Offline indicator shown to cashier

---

## 14. Subscriptions & Multi-Tenant
- Each business is isolated (multi-tenant)
- Subscription plans with feature limits
- Platform admin dashboard

---

## 15. GitHub Backup
- Code pushed to: github.com/maliki1234/pos
- Auto-push runs every night at 11:00 PM
- No manual action needed

---

## Tech Stack
| Layer | Technology |
|-------|-----------|
| Frontend | Next.js 14, TypeScript, Tailwind CSS |
| Backend | Node.js, Express, TypeScript |
| Database | PostgreSQL + Prisma ORM |
| Offline Storage | IndexedDB (Dexie.js) |
| Auth | JWT tokens |
| Barcodes | JsBarcode (CODE128) |
| Payments | M-Pesa Daraja API, Azampay Tanzania |

---

*Last updated: March 2026*
