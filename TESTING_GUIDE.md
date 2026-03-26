# POS System - Testing & Validation Guide

## 📋 Complete Test Scenarios

This guide provides comprehensive test cases to validate all features of the POS system.

---

## 🔐 1. Authentication & Authorization Tests

### Test 1.1: Register New User
```bash
POST /api/v1/auth/register
Content-Type: application/json

{
  "email": "testuser@example.com",
  "password": "testpass123",
  "name": "Test User",
  "role": "CASHIER"
}

Expected: 201 Created
Response includes: id, email, name, role
```

### Test 1.2: Login
```bash
POST /api/v1/auth/login
Content-Type: application/json

{
  "email": "testuser@example.com",
  "password": "testpass123"
}

Expected: 200 OK
Response includes: JWT token, user details
```

### Test 1.3: Access Protected Endpoint Without Token
```bash
GET /api/v1/products

Expected: 401 Unauthorized
Error: "No token provided"
```

### Test 1.4: Access Protected Endpoint With Invalid Token
```bash
GET /api/v1/products
Authorization: Bearer invalid_token_here

Expected: 401 Unauthorized
Error: "Invalid token"
```

### Test 1.5: Access with Valid Token
```bash
GET /api/v1/products
Authorization: Bearer <valid_jwt_token>

Expected: 200 OK
Returns list of products
```

### Test 1.6: RBAC - Cashier Cannot Create Product
```bash
POST /api/v1/products
Authorization: Bearer <cashier_token>
Content-Type: application/json

{
  "name": "Laptop",
  "sku": "LAP-001",
  "category": "Electronics"
}

Expected: 403 Forbidden
Error: "Insufficient permissions"
```

### Test 1.7: RBAC - Manager Can Create Product
```bash
POST /api/v1/products
Authorization: Bearer <manager_token>
Content-Type: application/json

{
  "name": "Laptop",
  "sku": "LAP-001",
  "category": "Electronics",
  "description": "High-performance laptop"
}

Expected: 201 Created
Returns: product with id, initial stock initialized
```

---

## 📦 2. Product Management Tests

### Test 2.1: Create Multiple Products
```bash
POST /api/v1/products (as MANAGER)

Product 1:
{
  "name": "Laptop",
  "sku": "LAP-001",
  "category": "Electronics",
  "description": "Dell XPS 13"
}

Product 2:
{
  "name": "Mouse",
  "sku": "MOU-001",
  "category": "Accessories",
  "description": "Wireless mouse"
}

Product 3:
{
  "name": "Monitor",
  "sku": "MON-001",
  "category": "Electronics",
  "description": "27 inch display"
}

Expected: All created successfully with unique IDs
```

### Test 2.2: Duplicate SKU Validation
```bash
POST /api/v1/products (as MANAGER)

{
  "name": "Different Product",
  "sku": "LAP-001",  // Already used
  "category": "Electronics"
}

Expected: 409 Conflict
Error: "SKU already exists"
```

### Test 2.3: List Products
```bash
GET /api/v1/products

Expected: 200 OK
Response: Array of products with pagination
```

### Test 2.4: List Products with Filtering
```bash
GET /api/v1/products?category=Electronics&skip=0&take=10

Expected: 200 OK
Response: Filtered products in Electronics category
```

### Test 2.5: Get Single Product
```bash
GET /api/v1/products/{product_id}

Expected: 200 OK
Response: Product with stock and price information
```

### Test 2.6: Update Product
```bash
PUT /api/v1/products/{product_id} (as MANAGER)
Content-Type: application/json

{
  "name": "Updated Laptop Name",
  "description": "Updated description"
}

Expected: 200 OK
Returns: Updated product
```

---

## 💰 3. Pricing Tests (Wholesale vs Retail)

### Test 3.1: Set Retail Pricing
```bash
POST /api/v1/products/{laptop_id}/pricing (as MANAGER)
Content-Type: application/json

{
  "customerType": "RETAIL",
  "unitPrice": 1200.00,
  "costPrice": 900.00,
  "minQuantity": 1,
  "discount": 0
}

Expected: 200 OK
Returns: Price configuration
```

### Test 3.2: Set Wholesale Pricing with Tiers
```bash
POST /api/v1/products/{laptop_id}/pricing (as MANAGER)
Tier 1:
{
  "customerType": "WHOLESALE",
  "unitPrice": 1000.00,
  "costPrice": 900.00,
  "minQuantity": 1,
  "discount": 5
}

Tier 2:
{
  "customerType": "WHOLESALE",
  "unitPrice": 950.00,
  "costPrice": 900.00,
  "minQuantity": 5,
  "discount": 10
}

Tier 3:
{
  "customerType": "WHOLESALE",
  "unitPrice": 900.00,
  "costPrice": 900.00,
  "minQuantity": 10,
  "discount": 15
}

Expected: All tiers created successfully
```

### Test 3.3: Get Product with Prices
```bash
GET /api/v1/products/{laptop_id}

Expected: 200 OK
Response includes:
- Product details
- Current stock level
- All price tiers (RETAIL and WHOLESALE)
```

---

## 👥 4. Customer Management Tests

### Test 4.1: Create Retail Customer
```bash
POST /api/v1/customers
Authorization: Bearer <token>
Content-Type: application/json

{
  "name": "John Doe",
  "email": "john@example.com",
  "phone": "555-1234",
  "customerType": "RETAIL"
}

Expected: 201 Created
Returns: customer with ID
```

### Test 4.2: Create Wholesale Customer
```bash
POST /api/v1/customers

{
  "name": "ABC Wholesale Ltd",
  "email": "contact@abc-wholesale.com",
  "phone": "555-5678",
  "customerType": "WHOLESALE"
}

Expected: 201 Created
Returns: wholesale customer
Note: This customer will trigger wholesale pricing
```

### Test 4.3: Duplicate Email Validation
```bash
POST /api/v1/customers

{
  "name": "Different Name",
  "email": "john@example.com",  // Already exists
  "customerType": "RETAIL"
}

Expected: 409 Conflict
Error: "Email already registered"
```

### Test 4.4: List Customers
```bash
GET /api/v1/customers

Expected: 200 OK
Response: All active customers
```

### Test 4.5: List Wholesale Customers Only
```bash
GET /api/v1/customers?customerType=WHOLESALE

Expected: 200 OK
Response: Only wholesale customers
```

### Test 4.6: Get Single Customer
```bash
GET /api/v1/customers/{customer_id}

Expected: 200 OK
Returns: Customer details
```

### Test 4.7: Update Customer
```bash
PUT /api/v1/customers/{customer_id}
Content-Type: application/json

{
  "name": "Updated Name",
  "phone": "555-9999"
}

Expected: 200 OK
Returns: Updated customer
```

---

## 📊 5. Stock Management Tests

### Test 5.1: Get Stock for Product
```bash
GET /api/v1/stock/{laptop_id}
Authorization: Bearer <token>

Expected: 200 OK
Response:
{
  "id": "stock_id",
  "productId": "laptop_id",
  "quantity": 0,  // Initial from seed
  "minThreshold": 10,
  "maxThreshold": 1000,
  "product": { ... }
}
```

### Test 5.2: Add Incoming Stock
```bash
POST /api/v1/stock/{laptop_id} (as MANAGER)
Content-Type: application/json

{
  "quantity": 50,
  "movementType": "IN",
  "referenceNo": "PO-2024-0001",
  "notes": "Purchase order received"
}

Expected: 200 OK
Returns: Updated stock with quantity = 50
Creates: StockMovement entry
```

### Test 5.3: Check Stock Movements
```bash
GET /api/v1/stock/{laptop_id}/movements

Expected: 200 OK
Response: Array of movements with timestamps
[
  {
    "movementType": "IN",
    "quantity": 50,
    "referenceNo": "PO-2024-0001",
    "createdAt": "2024-01-15T10:30:00Z"
  }
]
```

### Test 5.4: Stock Adjustment
```bash
POST /api/v1/stock/{laptop_id} (as MANAGER)

{
  "quantity": 45,  // Correcting inventory count
  "movementType": "ADJUSTMENT",
  "notes": "Cycle count adjustment - 5 units damaged"
}

Expected: 200 OK
Stock adjusted from 50 to 45
Logs movement with reason
```

### Test 5.5: Stock Out (Manual Deduction)
```bash
POST /api/v1/stock/{mouse_id} (as MANAGER)

{
  "quantity": 10,
  "movementType": "OUT",
  "referenceNo": "LOSS-001",
  "notes": "Theft/loss investigation"
}

Expected: 200 OK
Stock reduced
Movement logged as OUT
```

### Test 5.6: Prevent Negative Stock
```bash
POST /api/v1/stock/{laptop_id}

{
  "quantity": 100,  // Try to remove 100 when stock is 45
  "movementType": "OUT"
}

Expected: 409 Conflict
Error: "Insufficient stock for [Product] Available: 45, Requested: 100"
Stock unchanged
```

### Test 5.7: Low Stock Alert
```bash
GET /api/v1/stock/low-stock?threshold=20 (as MANAGER)

Expected: 200 OK
Response: All products with quantity <= 20
Example response:
[
  {
    "productId": "mouse_id",
    "quantity": 15,
    "product": { "name": "Mouse", ... }
  }
]
```

---

## 🛒 6. Transaction (Sales) Tests

### Test 6.1: Create Simple Retail Transaction
```bash
POST /api/v1/transactions (as CASHIER)
Authorization: Bearer <cashier_token>
Content-Type: application/json

{
  "items": [
    {
      "productId": "{laptop_id}",
      "quantity": 2,
      "discount": 0
    }
  ],
  "paymentMethod": "CASH"
}

Expected: 201 Created
Response:
{
  "id": "transaction_id",
  "transactionNo": "TXN-20240315-xxxxxx-xxxxx",
  "subtotal": "2400.00",      // 2 × 1200 (retail price)
  "discountAmount": "0.00",
  "taxAmount": "240.00",      // 10% tax
  "totalAmount": "2640.00",
  "paymentStatus": "COMPLETED",
  "items": [
    {
      "productId": "laptop_id",
      "quantity": 2,
      "unitPrice": "1200.00",
      "lineTotal": "2400.00"
    }
  ]
}

Stock Effect:
- Laptop stock reduced from 50 to 48
- Movement created: OUT, quantity 2
```

### Test 6.2: Create Wholesale Transaction with Volume Discount
```bash
POST /api/v1/transactions (as CASHIER)

{
  "customerId": "{wholesale_customer_id}",
  "items": [
    {
      "productId": "{laptop_id}",
      "quantity": 5  // Triggers tier 2 wholesale pricing
    }
  ],
  "paymentMethod": "BANK_TRANSFER"
}

Expected: 201 Created
Response:
{
  "transactionNo": "TXN-...",
  "subtotal": "4750.00",      // 5 × 950 (wholesale t2)
  "discountAmount": "475.00", // 10% volume discount
  "taxAmount": "475.00",      // Tax on subtotal
  "totalAmount": "4750.00",   // After all calculations
  "paymentStatus": "PENDING",  // Bank transfer pending
  "items": [
    {
      "productId": "laptop_id",
      "quantity": 5,
      "unitPrice": "855.00",   // After discount applied
      "lineTotal": "4275.00"
    }
  ]
}

Note: Customer type is WHOLESALE, so:
- Finds tier 2 (minQuantity 5 ≤ 5)
- unitPrice = 950, discount = 10%
- Final price = 950 * (1 - 0.10) = 855
- lineTotal = 855 * 5 = 4275
```

### Test 6.3: Create Multi-Item Transaction
```bash
POST /api/v1/transactions (as CASHIER)

{
  "customerId": "{retail_customer_id}",
  "items": [
    {
      "productId": "{laptop_id}",
      "quantity": 1
    },
    {
      "productId": "{mouse_id}",
      "quantity": 3
    },
    {
      "productId": "{monitor_id}",
      "quantity": 2
    }
  ],
  "paymentMethod": "CARD",
  "notes": "Customer bundle purchase"
}

Expected: 201 Created
Response:
{
  "subtotal": "2775.00",
  "discountAmount": "0.00",
  "taxAmount": "277.50",
  "totalAmount": "3052.50",
  "items": [
    { ... laptop item ... },
    { ... mouse items ... },
    { ... monitor items ... }
  ]
}

Calculations:
- Laptop: 1 × 1200 = 1200
- Mouse: 3 × 25 = 75
- Monitor: 2 × 750 = 1500
- Subtotal: 2775
- Tax (10%): 277.50
- Total: 3052.50
```

### Test 6.4: Duplicate Product in Same Transaction
```bash
POST /api/v1/transactions

{
  "items": [
    {
      "productId": "{laptop_id}",
      "quantity": 2
    },
    {
      "productId": "{laptop_id}",
      "quantity": 3
    }
  ],
  "paymentMethod": "CASH"
}

Expected: 201 Created
Both items included separately (or combined by system)
Total: 5 laptops
```

### Test 6.5: Missing Product
```bash
POST /api/v1/transactions

{
  "items": [
    {
      "productId": "non-existent-uuid",
      "quantity": 1
    }
  ],
  "paymentMethod": "CASH"
}

Expected: 404 Not Found
Error: "Product not found"
```

### Test 6.6: Insufficient Stock
```bash
POST /api/v1/transactions

{
  "items": [
    {
      "productId": "{laptop_id}",
      "quantity": 1000  // Stock only 48
    }
  ],
  "paymentMethod": "CASH"
}

Expected: 409 Conflict
Error: "Insufficient stock for Laptop. Available: 48, Requested: 1000"
No transaction created
Stock unchanged
```

### Test 6.7: Different Payment Methods
```bash
Create transactions with each payment method:
- CASH
- CARD
- CHEQUE
- BANK_TRANSFER
- MOBILE_MONEY

Expected: 201 Created for each
Payment status defaults based on method:
- CASH: COMPLETED (immediate)
- Others: PENDING (needs verification)
```

### Test 6.8: View All Transactions
```bash
GET /api/v1/transactions
Authorization: Bearer <token>

Expected: 200 OK
Response: All transactions with pagination
```

### Test 6.9: View Single Transaction
```bash
GET /api/v1/transactions/{transaction_id}

Expected: 200 OK
Returns: Complete transaction with items

OR by transaction number:
GET /api/v1/transactions/TXN-20240315-xxxxxx-xxxxx

Expected: 200 OK
Returns: Same transaction
```

### Test 6.10: Filter Transactions
```bash
GET /api/v1/transactions?customerId={id}&paymentStatus=COMPLETED

Expected: 200 OK
Returns: Filtered transactions
```

### Test 6.11: Void Retail Transaction
```bash
POST /api/v1/transactions/{transaction_id}/void (as MANAGER)
Content-Type: application/json

{
  "reason": "Customer return request"
}

Expected: 200 OK
Returns: Voided transaction
{
  "isVoided": true,
  "voidReason": "Customer return request",
  "paymentStatus": "REFUNDED"
}

Stock Effect:
- All items restored to stock
- Movement created: RETURN, quantity = original
- Stock back to pre-transaction level
```

### Test 6.12: Void Wholesale Transaction
```bash
POST /api/v1/transactions/{wholesale_txn_id}/void (as MANAGER)

{
  "reason": "Wholesale customer requested cancellation"
}

Expected: 200 OK
Stock completely restored
Movement logged as RETURN

Verify:
GET /api/v1/stock/{product_id}/movements
- Should show RETURN movement with quantity
```

### Test 6.13: Prevent Duplicate Void
```bash
POST /api/v1/transactions/{voided_txn_id}/void

{
  "reason": "Try to void again"
}

Expected: 400 Bad Request
Error: "Transaction is already voided"
```

### Test 6.14: RBAC - Cashier Cannot Void
```bash
POST /api/v1/transactions/{transaction_id}/void (as CASHIER)

{
  "reason": "Unauthorized attempt"
}

Expected: 403 Forbidden
Error: "Insufficient permissions"
```

---

## 🔄 7. Integration Tests

### Test 7.1: End-to-End Sales Flow
```
1. Login as cashier
2. Create retail customer
3. Create products with pricing
4. Add inventory
5. Create retail transaction
6. Verify stock reduced
7. Query transaction
8. Verify movement logged
→ All data consistent
```

### Test 7.2: Wholesale Flow
```
1. Login as manager
2. Create wholesale customer
3. Set wholesale pricing tiers
4. Add inventory
5. Login as cashier
6. Create transaction with wholesale customer
7. Verify tier 2 pricing applied
8. Check calculations correct
9. Verify stock reduced
→ All pricing correct
```

### Test 7.3: Inventory Management Flow
```
1. Set initial stock
2. Create sale (reduces stock)
3. Check movements
4. Restore via return (void)
5. Add new stock
6. Check all movements logged
→ Complete audit trail
```

---

## 📊 8. Data Validation Tests

### Test 8.1: Empty Required Field
```bash
POST /api/v1/auth/register

{
  "email": "test@example.com",
  "password": "password",
  "name": ""  // Empty required field
}

Expected: 400 Bad Request
Error: Validation error message
```

### Test 8.2: Invalid Email Format
```bash
POST /api/v1/customers

{
  "name": "Test",
  "email": "not-an-email",
  "customerType": "RETAIL"
}

Expected: 400 Bad Request
Error: Email validation failed
```

### Test 8.3: Negative Quantity
```bash
POST /api/v1/transactions

{
  "items": [
    {
      "productId": "uuid",
      "quantity": -5
    }
  ],
  "paymentMethod": "CASH"
}

Expected: 400 Bad Request
Error: Quantity must be positive
```

### Test 8.4: Invalid Enum Values
```bash
POST /api/v1/transactions

{
  "items": [...],
  "paymentMethod": "INVALID_METHOD"
}

Expected: 400 Bad Request
Error: Invalid payment method
```

---

## ✅ Summary Checklist

### Authentication
- [ ] Register user
- [ ] Login
- [ ] JWT token validation
- [ ] Protected routes
- [ ] Role-based access
- [ ] Password hashing
- [ ] Invalid credentials

### Products
- [ ] Create product
- [ ] Duplicate SKU prevention
- [ ] List products
- [ ] Filter by category
- [ ] Get single product
- [ ] Update product

### Pricing
- [ ] Set retail pricing
- [ ] Set wholesale pricing
- [ ] Multiple price tiers
- [ ] Price tier selection

### Customers
- [ ] Create retail customer
- [ ] Create wholesale customer
- [ ] Duplicate email prevention
- [ ] List customers
- [ ] Filter by type
- [ ] Get single customer
- [ ] Update customer

### Stock
- [ ] Get stock
- [ ] Add incoming stock
- [ ] View movements
- [ ] Adjust inventory
- [ ] Prevent negative stock
- [ ] Low stock alerts

### Transactions
- [ ] Create retail transaction
- [ ] Create wholesale transaction
- [ ] Multiple items
- [ ] Different payment methods
- [ ] Void transactions
- [ ] Stock impact verification
- [ ] Multi-tier pricing

### Data Validation
- [ ] Empty fields
- [ ] Invalid formats
- [ ] Out-of-range values
- [ ] Invalid enums

---

## 🚀 Performance Tests

### Load Testing
```bash
# Create 1000 products
for i in {1..1000}; do
  curl -X POST http://localhost:3000/api/v1/products \
    -H "Authorization: Bearer <token>" \
    -d "{...}"
done

# Create 10000 transactions
for i in {1..10000}; do
  curl -X POST http://localhost:3000/api/v1/transactions \
    -H "Authorization: Bearer <token>" \
    -d "{...}"
done

# Measure response times
```

---

These tests validate all core functionality. Run them sequentially or in order.

**Status:** ✅ Ready for testing
