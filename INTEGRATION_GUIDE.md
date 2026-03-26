# POS System - Integration Guide

## 📋 Table of Contents
1. [System Overview](#system-overview)
2. [Data Flow](#data-flow)
3. [Module Interactions](#module-interactions)
4. [Common Workflows](#common-workflows)
5. [Extension Points](#extension-points)

## System Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                    POS System Architecture                      │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐        │
│  │ Client   │  │ Client   │  │ Client   │  │ Client   │        │
│  │ App      │  │ Web      │  │ Mobile   │  │ Terminal │        │
│  └────┬─────┘  └────┬─────┘  └────┬─────┘  └────┬─────┘        │
│       │             │             │             │               │
│       └─────────────┴─────────────┴─────────────┘               │
│                      │                                           │
│                 HTTP/REST API                                    │
│                      │                                           │
│       ┌──────────────▼──────────────────────┐                   │
│       │   Express.js Application Server     │                   │
│       ├──────────────────────────────────────┤                   │
│       │  Middleware Stack:                   │                   │
│       │  - CORS                              │                   │
│       │  - Body Parser                       │                   │
│       │  - Morgan (Logging)                  │                   │
│       │  - Authentication (JWT)              │                   │
│       │  - Authorization (RBAC)              │                   │
│       │  - Error Handler                     │                   │
│       └──────────────┬───────────────────────┘                   │
│                      │                                           │
│       ┌──────────────▼──────────────────────┐                   │
│       │   Route Handlers (5 route files)     │                   │
│       ├──────────────────────────────────────┤                   │
│       │  - authRoutes      (/auth)           │                   │
│       │  - productRoutes   (/products)       │                   │
│       │  - customerRoutes  (/customers)      │                   │
│       │  - stockRoutes     (/stock)          │                   │
│       │  - transactionRoutes (/transactions) │                   │
│       └──────────────┬───────────────────────┘                   │
│                      │                                           │
│       ┌──────────────▼──────────────────────┐                   │
│       │   Controllers (5 controller files)   │                   │
│       ├──────────────────────────────────────┤                   │
│       │  - authController                    │                   │
│       │  - productController                 │                   │
│       │  - customerController                │                   │
│       │  - stockController                   │                   │
│       │  - transactionController             │                   │
│       └──────────────┬───────────────────────┘                   │
│                      │                                           │
│       ┌──────────────▼──────────────────────┐                   │
│       │   Services (3 service files)         │                   │
│       ├──────────────────────────────────────┤                   │
│       │  - priceService                      │                   │
│       │  - stockService                      │                   │
│       │  - transactionService                │                   │
│       └──────────────┬───────────────────────┘                   │
│                      │                                           │
│       ┌──────────────▼──────────────────────┐                   │
│       │   Prisma ORM Layer                   │                   │
│       ├──────────────────────────────────────┤                   │
│       │  - Migrations                        │                   │
│       │  - TypeScript Generated Client       │                   │
│       │  - Query Builder                     │                   │
│       └──────────────┬───────────────────────┘                   │
│                      │                                           │
│       ┌──────────────▼──────────────────────┐                   │
│       │   PostgreSQL Database                │                   │
│       ├──────────────────────────────────────┤                   │
│       │  - users                             │                   │
│       │  - customers                         │                   │
│       │  - products                          │                   │
│       │  - product_stocks                    │                   │
│       │  - product_prices                    │                   │
│       │  - transactions                      │                   │
│       │  - transaction_items                 │                   │
│       │  - stock_movements                   │                   │
│       └──────────────────────────────────────┘                   │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

## Data Flow

### Authentication Flow
```
1. Client submits credentials
   POST /auth/login { email, password }
                ↓
2. authController.login() validates
                ↓
3. Password verified via bcryptjs
                ↓
4. JWT token generated
                ↓
5. Token returned to client
                ↓
6. Client adds token to Authorization header
   GET /products
   Authorization: Bearer <token>
                ↓
7. authenticate middleware validates JWT
                ↓
8. Request payload updated with user info
   req.user = { userId, email, role }
                ↓
9. authorize middleware checks user role
                ↓
10. Route handler executed with req.user available
```

### Product Creation Flow
```
POST /products
{ name, description, sku, category }
                ↓
authenticate middleware
(validates JWT)
                ↓
authorize(['ADMIN', 'MANAGER'])
(checks role)
                ↓
productController.createProduct()
                ├─ Joi schema validation
                ├─ Check duplicate SKU
                ├─ Create product record
                ├─ Initialize stock
                └─ Return 201 with product data
                ↓
PostgreSQL database updated
```

### Transaction Processing Flow
```
POST /transactions
{
  customerId,
  items: [{ productId, quantity, discount }],
  paymentMethod
}
                ↓
transactionController.createTransaction()
                ├─ Validate request schema
                ├─ Call transactionService.createTransaction()
                │   ├─ Validate user exists
                │   ├─ Validate customer exists
                │   ├─ For each item:
                │   │   ├─ Validate product exists
                │   │   ├─ Call stockService.reserveStock()
                │   │   ├─ Get customer type
                │   │   ├─ Call priceService.calculateLineTotal()
                │   │   │   └─ Select price tier
                │   │   │   └─ Apply volume discount
                │   │   ├─ Calculate line total
                │   │   └─ Accumulate subtotal
                │   ├─ Calculate tax (10% default)
                │   ├─ Create transaction record
                │   ├─ Create transaction_items
                │   ├─ For each item:
                │   │   └─ Update stock via stockService
                │   │       └─ Create stock_movement record
                │   └─ Return complete transaction
                │
                ├─ Serialize response
                └─ Return 201 with transaction details
                ↓
PostgreSQL database updated:
- transaction inserted
- transaction_items inserted
- product_stocks updated
- stock_movements inserted
```

### Stock Management Flow
```
User checks stock:
GET /stock/{productId}
                ↓
stockController.getStock()
                ├─ Call stockService.getStock()
                │   ├─ Find ProductStock record
                │   ├─ Include Product data
                │   └─ Return stock object
                └─ Return with product info
                ↓

User updates stock:
POST /stock/{productId}
{ quantity, movementType, referenceNo, notes }
                ↓
authorize(['ADMIN', 'MANAGER'])
                ↓
stockController.updateStock()
                ├─ Validate request
                ├─ Call stockService.updateStock()
                │   ├─ Get current stock
                │   ├─ Apply movement:
                │   │   ├─ IN/RETURN: Add quantity
                │   │   ├─ OUT: Check availability
                │   │   └─ ADJUSTMENT: Set quantity
                │   ├─ Update ProductStock.quantity
                │   ├─ Create StockMovement record
                │   └─ Log operation
                └─ Return updated stock
                ↓

User checks low stock:
GET /stock/low-stock?threshold=10
                ↓
authorize(['ADMIN', 'MANAGER'])
                ↓
stockController.getLowStockProducts()
                ├─ Call stockService.getLowStockProducts(threshold)
                │   ├─ Query ProductStock where quantity <= threshold
                │   ├─ Include Product details
                │   ├─ Order by quantity ascending
                │   └─ Return array
                └─ Return low stock items
```

### Pricing Logic Flow
```
During transaction creation:
Customer Type = WHOLESALE, Quantity = 5
                ↓
priceService.calculateLineTotal(productId, 'WHOLESALE', 5)
                ↓
├─ Get product by ID
├─ Find applicable price tier:
│   Filter where:
│   - productId matches
│   - customerType = 'WHOLESALE'
│   - minQuantity <= 5
│   - isActive = true
│   Order by minQuantity DESC
│   Take first (highest minQuantity)
├─ Matched: Tier with minQuantity=5, unitPrice=$950
├─ Calculate discount: 10%
├─ Final price per unit: $950 - ($950 * 0.10) = $855
├─ Line total: $855 * 5 = $4,275
└─ Return { unitPrice: 855, lineTotal: 4275, discount: 95 }
                ↓
Applied to transaction calculation
```

## Module Interactions

### Authentication Module
**Files:**
- `src/middlewares/auth.ts`
- `src/controllers/authController.ts`

**Interfaces:**
- `authenticate()` - JWT verification
- `authorize()` - Role checking
- `login()` - User authentication
- `register()` - User creation

**Dependencies:**
- jsonwebtoken (JWT handling)
- bcryptjs (password hashing)
- Prisma (database access)

### Product Module
**Files:**
- `src/controllers/productController.ts`
- `src/routes/productRoutes.ts`

**Services Used:**
- `stockService.initializeStock()` - Initialize stock on product creation
- `priceService.createPrice()` - Set product pricing

**Database Access:**
- CREATE: products, product_stocks, product_prices
- READ: products with stock and pricing
- UPDATE: products, product_prices
- DELETE: soft delete via isActive flag

### Stock Module
**Files:**
- `src/services/stockService.ts`
- `src/controllers/stockController.ts`
- `src/routes/stockRoutes.ts`

**Key Functions:**
- `getStock()` - Retrieve current stock
- `updateStock()` - Modify inventory
- `reserveStock()` - Check availability
- `getStockMovements()` - Audit history
- `getLowStockProducts()` - Alert system

**Database Access:**
- product_stocks
- stock_movements

### Price Module
**Files:**
- `src/services/priceService.ts`

**Key Functions:**
- `getPrice()` - Fetch price tier
- `createPrice()` - Set new price
- `calculateLineTotal()` - Compute final price

**Used by:**
- transactionService (price calculation)
- productController (price management)

### Transaction Module
**Files:**
- `src/services/transactionService.ts`
- `src/controllers/transactionController.ts`
- `src/routes/transactionRoutes.ts`

**Orchestrates:**
- User validation
- Customer validation
- Stock reservation
- Price calculation
- Transaction creation
- Stock deduction
- Stock movement logging

**Database Access:**
- transactions
- transaction_items
- product_stocks (via stockService)
- product_prices (via priceService)
- stock_movements

### Customer Module
**Files:**
- `src/controllers/customerController.ts`
- `src/routes/customerRoutes.ts`

**Functions:**
- CRUD operations on customers
- Classify as RETAIL or WHOLESALE
- Deactivation (soft delete)

**Database Access:**
- customers

## Common Workflows

### Workflow 1: New Wholesale Customer Setup
```
1. Admin/ Manager logs in
   POST /auth/login
   
2. Create wholesale customer
   POST /customers
   { name, email, customerType: 'WHOLESALE' }
   
3. For each product they buy:
   POST /products/{productId}/pricing
   { 
     customerType: 'WHOLESALE',
     unitPrice: 1000,
     costPrice: 900,
     minQuantity: 1,
     discount: 5
   }
   
4. Cashier can now process their transactions
```

### Workflow 2: Process a Sale
```
1. Cashier logs in
   POST /auth/login
   
2. Get available products
   GET /products
   
3. Look up customer (or create as walk-in)
   GET /customers?customerType=RETAIL
   
4. Create transaction
   POST /transactions
   {
     customerId: "uuid",
     items: [
       { productId: "uuid", quantity: 2, discount: 0 }
     ],
     paymentMethod: "CASH"
   }
   
5. Transaction complete - system:
   - Calculates price based on customer type
   - Applies tax
   - Deducts stock
   - Logs movements
   - Returns receipt data
```

### Workflow 3: Handle Return
```
1. Customer returns items
   
2. Manager/Cashier retrieves transaction
   GET /transactions/{transactionNo}
   
3. Void the transaction
   POST /transactions/{transactionId}/void
   { reason: "Customer return" }
   
System automatically:
   - Restores stock quantities
   - Logs return as stock movement
   - Marks transaction as REFUNDED
   - Maintains audit trail
```

### Workflow 4: Inventory Recount
```
1. Manager checks low stock
   GET /stock/low-stock?threshold=20
   
2. Receives new inventory
   
3. Update stock for each product
   POST /stock/{productId}
   {
     quantity: 100,
     movementType: "IN",
     referenceNo: "PO-2024-0001",
     notes: "Purchase order received"
   }
   
4. System logs movement with timestamp
```

## Extension Points

### 1. Add New Payment Methods
**File:** `prisma/schema.prisma`
```prisma
enum PaymentMethod {
  CASH
  CARD
  CHEQUE
  BANK_TRANSFER
  MOBILE_MONEY
  // Add new: CRYPTOCURRENCY, STORE_CREDIT, etc.
}
```

### 2. Add New Customer Types
**File:** `prisma/schema.prisma`
```prisma
enum CustomerType {
  RETAIL
  WHOLESALE
  // Add: VIP, CORPORATE, DISTRIBUTOR, etc.
}
```

### 3. Add New User Roles
**File:** `prisma/schema.prisma`
```prisma
enum UserRole {
  ADMIN
  MANAGER
  CASHIER
  // Add: AUDITOR, INVENTORY_MANAGER, SALES_REP, etc.
}
```

### 4. Modify Tax Calculation
**File:** `src/services/transactionService.ts` (line ~75)
```typescript
// Change from 10% to configurable
const taxRate = 0.1; // Make dynamic from config
const taxAmount = subtotal * taxRate;
```

### 5. Add Discount Tiers
**File:** `src/services/priceService.ts`
- Modify `calculateLineTotal()` to support cascading discounts
- Add discount codes system
- Implement loyalty points

### 6. Add Multi-Location Support
**Database:** Add `stores` table and `storeId` to relevant tables
```prisma
model Store {
  id        String   @id @default(uuid())
  name      String
  location  String
  stocks    ProductStock[]
  transactions Transaction[]
}
```

### 7. Add Reports Module
**New File:** `src/services/reportService.ts`
```typescript
class ReportService {
  async salesToday()
  async revenueByProduct()
  async inventoryValuation()
  async topProducts()
  async salesByEmployee()
}
```

### 8. Add Notification System
**New File:** `src/services/notificationService.ts`
```typescript
class NotificationService {
  async alertLowStock()
  async sendReceiptEmail()
  async notifyLargeTransaction()
}
```

## File Dependencies Graph

```
src/index.ts
├─ config/
├─ middlewares/
│  ├─ auth.ts
│  └─ errorHandler.ts
├─ utils/
│  ├─ logger.ts
│  └─ errors.ts
└─ routes/
   ├─ authRoutes.ts → controllers/authController.ts
   ├─ productRoutes.ts → controllers/productController.ts → services/priceService.ts
   ├─ customerRoutes.ts → controllers/customerController.ts
   ├─ stockRoutes.ts → controllers/stockController.ts → services/stockService.ts
   └─ transactionRoutes.ts → controllers/transactionController.ts → services/transactionService.ts
      ├─ services/stockService.ts
      ├─ services/priceService.ts
      └─ utils/errors.ts

Prisma: All services depend on prisma client
```

## Performance Optimization Opportunities

1. **Database Indexing**
   - Index on `transactions.customerId`
   - Index on `stock_movements.createdAt`
   - Index on `products.category`

2. **Caching**
   - Cache product prices (stable data)
   - Cache low stock threshold configs
   - Cache user permissions

3. **Pagination**
   - All list endpoints support `skip` and `take`
   - Implement cursor-based pagination for large datasets

4. **Query Optimization**
   - Use Prisma `include` strategically
   - Avoid N+1 queries
   - Batch related queries

## Testing Coverage Needed

- [ ] Authentication & authorization
- [ ] Product CRUD operations
- [ ] Price tier selection logic
- [ ] Stock reservation and update
- [ ] Transaction workflow
- [ ] Tax calculation
- [ ] Volume discount application
- [ ] Return/void processing
- [ ] Error handling
- [ ] Input validation

---

This integration guide provides a complete picture of how all components work together to deliver a complete POS system.
