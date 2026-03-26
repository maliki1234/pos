# POS System - Architecture & Design Guide

## System Architecture

### Layered Architecture

```
┌─────────────────────────────────────┐
│     API Routes & Controllers        │
├─────────────────────────────────────┤
│   Service Layer (Business Logic)    │
├─────────────────────────────────────┤
│   Database Abstraction (Prisma)     │
├─────────────────────────────────────┤
│      PostgreSQL Database            │
└─────────────────────────────────────┘
```

### Core Components

#### 1. **Controllers**
- Handle HTTP requests/responses
- Input validation
- Call appropriate services
- Return standardized responses

#### 2. **Services**
- Implement business logic
- Orchestrate database operations
- Handle transactions
- Ensure data consistency

#### 3. **Middleware**
- Authentication (JWT verification)
- Authorization (role-based access)
- Error handling
- Request logging

#### 4. **Database Models**
- User, Customer, Product, etc.
- Relationships and constraints
- Indexes for performance

## Wholesale vs Retail Logic

### Price Determination Flow

```
Transaction Request
        ↓
   Get Customer Type
        ↓
   [Is Wholesale?]
      /          \
    YES          NO
    ↓            ↓
Wholesale    Retail Pricing
Pricing      (Fixed or low discount)
(Tiered)
    ↓
Get Order Quantity
    ↓
[Match Price Tier]
    ↓
Apply Volume Discount
    ↓
Calculate Line Total
```

### Pricing Tiers

**Retail Customer (Default)**
- Single price per product
- No quantity-based discounts
- Applied to walk-in customers
- Higher unit prices

**Wholesale Customer**
- Multiple price tiers
- Quantity-based discounts
- Applied to registered wholesalers
- Lower unit prices

### Example Scenario

**Product: Laptop**

```
Retail Customer (buys 3):
  Unit Price: $1,200.00
  Quantity: 3
  Discount: $0
  Line Total: $3,600.00

Wholesale Customer (buys 3):
  Unit Price: $1,000.00 (tier for 1+ units)
  Quantity: 3
  Discount: 5% = $150.00
  Line Total: $2,850.00

Wholesale Customer (buys 5):
  Unit Price: $950.00 (tier for 5+ units)
  Quantity: 5
  Discount: 10% = $475.00
  Line Total: $4,275.00

Wholesale Customer (buys 10):
  Unit Price: $900.00 (tier for 10+ units)
  Quantity: 10
  Discount: 15% = $1,350.00
  Line Total: $7,650.00
```

## Stock Management System

### Stock Operations

#### Stock In (Receiving)
```
Source: PO (Purchase Order), Returns, Adjustments
↓
Update ProductStock.quantity += amount
↓
Create StockMovement record
↓
Log with reference number
```

#### Stock Out (Sales)
```
Source: Sales Transactions
↓
Verify available stock
↓
Reserve stock (prevents overselling)
↓
Create transaction items
↓
Update ProductStock.quantity -= amount
↓
Create StockMovement record
↓
Link to transaction
```

#### Stock Adjustment
```
Source: Damage, Loss, Audit Discrepancy
↓
Update ProductStock.quantity = new_amount
↓
Create StockMovement record
↓
Document reason
```

### Stock Safety Features

1. **Availability Check**: Before transaction confirmation
2. **Reservation**: Prevents concurrent overselling
3. **Movement Tracking**: Complete audit trail
4. **Low Stock Alerts**: Early warning system
5. **Threshold Management**: Min/max levels

## Transaction Processing

### Transaction Flow

```
1. RECEIVE ORDER
   └─ Validate items, quantities

2. CHECK STOCK
   └─ Verify availability
   └─ Lock/Reserve inventory

3. PRICE CALCULATION
   └─ Determine customer type
   └─ Select price tier
   └─ Apply discounts
   └─ Calculate tax

4. CREATE TRANSACTION
   └─ Save order record
   └─ Link transaction items
   └─ Save payment info

5. UPDATE INVENTORY
   └─ Deduct stock
   └─ Log movement
   └─ Update stock levels

6. CONFIRM & RETURN
   └─ Generate receipt
   └─ Return transaction details
```

### Transaction States

```
COMPLETED  ─→ Normal transaction
  ↓
[Payment successful?]
  ├─ YES: COMPLETED
  └─ NO: PENDING (awaiting payment)

REFUNDED   ─→ Voided with stock restoration
```

## Authorization Model

### Role Hierarchy

```
ADMIN
  ├─ Can perform all operations
  ├─ User management
  ├─ System configuration
  └─ Reports & analytics

MANAGER
  ├─ Product management
  ├─ Pricing setup
  ├─ Stock management
  ├─ Customer management
  ├─ Transaction voiding
  └─ Reports

CASHIER
  ├─ Create transactions
  ├─ View catalog
  ├─ View stock
  └─ View customer info
```

### Access Control Examples

| Operation | ADMIN | MANAGER | CASHIER |
|-----------|-------|---------|---------|
| Create Product | ✅ | ✅ | ❌ |
| Create Transaction | ✅ | ✅ | ✅ |
| Void Transaction | ✅ | ✅ | ❌ |
| Update Stock | ✅ | ✅ | ❌ |
| Set Pricing | ✅ | ✅ | ❌ |
| Create User | ✅ | ❌ | ❌ |

## Data Validation

### Multi-Layer Validation

1. **Schema Validation** (Joi)
   - Required fields
   - Data types
   - Format validation
   - Business rule validation

2. **Database Constraints**
   - Unique constraints (SKU, Email)
   - Foreign key constraints
   - Check constraints

3. **Business Logic Validation**
   - Stock availability
   - Price validity
   - Decimal precision

### Example: Transaction Validation

```
1. Check if items array is not empty
2. For each item:
   - Product exists
   - Quantity is positive integer
   - Stock available
   - Pricing exists for customer type
3. Validate payment method
4. Validate customer (if specified)
5. Ensure user exists
```

## Error Handling Strategy

### Error Classes

```
AppError (Base)
├─ ValidationError (400)
├─ AuthenticationError (401)
├─ AuthorizationError (403)
├─ NotFoundError (404)
├─ ConflictError (409)
└─ InsufficientStockError (409)
```

### Error Response Format

```json
{
  "success": false,
  "error": "ErrorClassName",
  "message": "Human-readable error message"
}
```

## Performance Considerations

### Database Indexes
- Created on foreign keys
- Recommended on `sku`, `email`, `customerType`
- Helps with filtering and joins

### Query Optimization
- Select only needed fields
- Use include() strategically
- Pagination for large result sets

### Caching Opportunities
- Product pricing (stable)
- Stock thresholds
- User permissions

## Security Features

### Authentication
- JWT token-based
- Secure password hashing (bcryptjs)
- Token expiration
- Role-based authorization

### Data Protection
- Input validation
- SQL injection prevention (Prisma)
- CORS enabled
- Error message sanitization

### Audit Trail
- All stock movements logged
- Transaction records immutable (void instead of delete)
- Timestamps on all records
- User tracking

## Scalability Strategies

### Horizontal Scaling
1. Stateless API servers
2. Load balancer
3. Session management via JWT
4. Database connection pooling

### Vertical Scaling
1. Database indexing
2. Query optimization
3. Caching layer (Redis)
4. Async operations

### Monitoring
1. Error logging
2. Request logging
3. Performance metrics
4. Database monitoring

## Testing Scenarios

### Stock Management
```
Scenario 1: Normal sale
  1. Create product with 100 units in stock
  2. Sell 30 units
  3. Verify stock = 70
  4. Check movement recorded

Scenario 2: Insufficient stock
  1. Create product with 10 units
  2. Attempt to sell 20 units
  3. Verify error thrown
  4. Verify stock unchanged

Scenario 3: Return processing
  1. Process sale (stock -30)
  2. Void transaction
  3. Verify stock restored (+30)
```

### Pricing Logic
```
Scenario 1: Retail customer
  1. Create retail customer
  2. Create transaction with 2 items
  3. Verify retail prices applied
  4. Verify no volume discount

Scenario 2: Volume discount (Wholesale)
  1. Create wholesale customer
  2. Order 3 items (tier 1 price)
  3. Order 5 items (tier 2 price)
  4. Verify tier 2 applied for order of 5
  5. Verify volume discount applied
```

## API Response Examples

### Successful Transaction
```json
{
  "success": true,
  "message": "Transaction processed successfully",
  "data": {
    "id": "uuid",
    "transactionNo": "TXN-20240318-123456-ABC",
    "subtotal": "5700.00",
    "discountAmount": "285.00",
    "taxAmount": "570.00",
    "totalAmount": "5985.00",
    "paymentStatus": "COMPLETED",
    "items": [
      {
        "productId": "uuid",
        "product": { "name": "Laptop", "sku": "LAPTOP-001" },
        "quantity": 5,
        "unitPrice": "1000.00",
        "lineTotal": "5000.00"
      }
    ]
  }
}
```

## Future Enhancement Roadmap

### Phase 2
- Multi-location support
- Advanced reporting (sales, revenue, inventory)
- Supplier management
- Return management system

### Phase 3
- Barcode/QR code scanning
- Receipt printing
- Payment gateway integration
- Mobile app integration

### Phase 4
- Analytics dashboards
- Predictive inventory
- Seasonal pricing
- Customer loyalty program
