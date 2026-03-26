# POS System

A clean, scalable Point of Sale (POS) system built with Node.js, Prisma, and PostgreSQL. Features comprehensive wholesale and retail pricing logic with robust stock management.

## Features

- ✅ **User Management**: Multi-role support (Admin, Manager, Cashier)
- ✅ **Product Management**: Complete product lifecycle management
- ✅ **Wholesale & Retail Pricing**: Separate pricing tiers with quantity-based discounts
- ✅ **Stock Management**: Real-time inventory tracking with movements history
- ✅ **Transaction Processing**: Create, track, and void transactions
- ✅ **Customer Management**: Support for retail and wholesale customers
- ✅ **JWT Authentication**: Secure API with role-based authorization
- ✅ **Stock Alerts**: Track low stock products
- ✅ **Comprehensive Logging**: Audit trail for all operations
- ✅ **Error Handling**: Robust error handling and validation

## Tech Stack

- **Backend**: Node.js with Express.js
- **Language**: TypeScript
- **Database**: PostgreSQL
- **ORM**: Prisma
- **Authentication**: JWT
- **Validation**: Joi
- **Logging**: Morgan + Custom logger

## Installation

### Prerequisites

- Node.js >= 16.x
- PostgreSQL >= 12.x
- npm or yarn

### Setup Steps

1. **Clone and install dependencies**
```bash
npm install
```

2. **Configure environment variables**
```bash
# Copy example to .env
cp .env.example .env

# Update .env with your PostgreSQL connection
DATABASE_URL=postgresql://user:password@localhost:5432/pos_system
JWT_SECRET=your-secret-key
```

3. **Setup database**
```bash
# Run migrations
npm run prisma:migrate

# Seed sample data (optional)
npm run seed
```

4. **Start development server**
```bash
npm run dev
```

The API will be available at `http://localhost:3000`

## API Documentation

### Base URL
```
http://localhost:3000/api/v1
```

### Authentication

All endpoints except `/auth/login` and `/auth/register` require JWT authentication.

**Request Header:**
```
Authorization: Bearer <token>
```

### Authentication Endpoints

#### Register User
```
POST /auth/register
```

**Request Body:**
```json
{
  "email": "user@example.com",
  "password": "password123",
  "name": "John Doe",
  "role": "CASHIER"
}
```

#### Login
```
POST /auth/login
```

**Request Body:**
```json
{
  "email": "user@example.com",
  "password": "password123"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Login successful",
  "data": {
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "user": {
      "id": "uuid",
      "email": "user@example.com",
      "name": "John Doe",
      "role": "CASHIER"
    }
  }
}
```

### Product Endpoints

#### Create Product
```
POST /products
```
**Required Role**: ADMIN, MANAGER

**Request Body:**
```json
{
  "name": "Laptop",
  "description": "High-performance laptop",
  "sku": "LAPTOP-001",
  "category": "Electronics"
}
```

#### Get Product
```
GET /products/{productId}
```

#### List Products
```
GET /products?category=Electronics&skip=0&take=50
```

#### Update Product
```
PUT /products/{productId}
```
**Required Role**: ADMIN, MANAGER

#### Set Product Pricing
```
POST /products/{productId}/pricing
```
**Required Role**: ADMIN, MANAGER

**Request Body:**
```json
{
  "customerType": "RETAIL",
  "unitPrice": 1200.00,
  "costPrice": 900.00,
  "minQuantity": 1,
  "discount": 0
}
```

### Stock Management Endpoints

#### Get Stock
```
GET /stock/{productId}
```

#### Update Stock
```
POST /stock/{productId}
```
**Required Role**: ADMIN, MANAGER

**Request Body:**
```json
{
  "quantity": 50,
  "movementType": "IN",
  "referenceNo": "PO-001",
  "notes": "Restocking"
}
```

**Movement Types**: `IN`, `OUT`, `ADJUSTMENT`, `RETURN`

#### Get Stock Movements
```
GET /stock/{productId}/movements?limit=50
```

#### Get Low Stock Products
```
GET /stock/low-stock?threshold=10
```
**Required Role**: ADMIN, MANAGER

### Customer Endpoints

#### Create Customer
```
POST /customers
```

**Request Body:**
```json
{
  "name": "ABC Wholesale Ltd",
  "email": "contact@abc.com",
  "phone": "1234567890",
  "customerType": "WHOLESALE"
}
```

#### Get Customer
```
GET /customers/{customerId}
```

#### List Customers
```
GET /customers?customerType=WHOLESALE&skip=0&take=50
```

#### Update Customer
```
PUT /customers/{customerId}
```

#### Deactivate Customer
```
DELETE /customers/{customerId}
```
**Required Role**: ADMIN, MANAGER

### Transaction Endpoints

#### Create Transaction
```
POST /transactions
```
**Required Role**: CASHIER, MANAGER, ADMIN

**Request Body:**
```json
{
  "customerId": "uuid",
  "items": [
    {
      "productId": "uuid",
      "quantity": 2,
      "discount": 5.00
    }
  ],
  "paymentMethod": "CASH",
  "notes": "Regular customer"
}
```

**Payment Methods**: `CASH`, `CARD`, `CHEQUE`, `BANK_TRANSFER`, `MOBILE_MONEY`

#### Get Transaction
```
GET /transactions/{transactionId}
```

Or by transaction number:
```
GET /transactions/TXN-20240318-123456-xyz
```

#### List Transactions
```
GET /transactions?customerId=uuid&paymentStatus=COMPLETED&skip=0&take=50
```

**Query Parameters:**
- `customerId`: Filter by customer
- `userId`: Filter by user/cashier
- `paymentStatus`: `PENDING`, `COMPLETED`, `FAILED`, `REFUNDED`
- `startDate`: ISO date string
- `endDate`: ISO date string

#### Void Transaction
```
POST /transactions/{transactionId}/void
```
**Required Role**: MANAGER, ADMIN

**Request Body:**
```json
{
  "reason": "Customer returned items"
}
```

## Pricing Logic

### Wholesale Pricing
- Lower unit prices than retail
- Quantity-based discounts
- Applied to customers with `customerType: WHOLESALE`

### Retail Pricing
- Standard unit prices
- Minimal or no discounts
- Default for walk-in customers

### Price Tier Example
```
Product: Laptop
RETAIL:
  - 1+ units: $1200.00 (no discount)

WHOLESALE:
  - 1+ units: $1000.00 (5% discount)
  - 5+ units: $950.00 (10% discount)
  - 10+ units: $900.00 (15% discount)
```

The system automatically selects the best matching price tier based on:
1. Customer type (retail/wholesale)
2. Order quantity

## Stock Management

### Movement Types
- **IN**: Incoming stock (purchases, restocking)
- **OUT**: Outgoing stock (sales)
- **ADJUSTMENT**: Direct quantity adjustment
- **RETURN**: Customer returns

### Low Stock Alerts
```bash
GET /api/v1/stock/low-stock?threshold=10
```

Returns all products with stock ≤ threshold

## Database Schema

### Users
- Admin, Manager, Cashier roles
- Password-hashed storage
- Activity tracking

### Customers
- Retail or Wholesale classification
- Contact information
- Transaction history linked

### Products
- SKU-based identification
- Category classification
- Multi-tier pricing support

### ProductStock
- Real-time quantity tracking
- Min/max thresholds
- Stock movement audit trail

### Transactions
- Transaction number generation
- Item-level tracking
- Payment method and status
- Tax and discount calculations

## Error Handling

The API returns standardized error responses:

```json
{
  "success": false,
  "error": "ValidationError",
  "message": "Prices must be greater than 0"
}
```

Common HTTP Status Codes:
- `200`: Success
- `201`: Created
- `400`: Validation Error
- `401`: Authentication Error
- `403`: Authorization Error
- `404`: Not Found
- `409`: Conflict (e.g., insufficient stock)
- `500`: Server Error

## Development

### Build
```bash
npm run build
```

### Type Checking
```bash
npm run type-check
```

### Linting
```bash
npm run lint
```

### Database Studio
```bash
npm run prisma:studio
```

Opens Prisma Studio for database management at `http://localhost:5555`

## Demo Credentials

After seeding:
```
Admin    - admin@pos.local / admin123
Manager  - manager@pos.local / manager123
Cashier  - cashier@pos.local / cashier123
```

## Project Structure

```
├── src/
│   ├── config/          # Configuration files
│   ├── controllers/      # Route controllers
│   ├── middlewares/      # Express middleware
│   ├── routes/          # API routes
│   ├── services/        # Business logic
│   ├── types/           # TypeScript types
│   ├── utils/           # Utilities (logger, errors)
│   ├── prisma/          # Prisma seed files
│   └── index.ts         # App entry point
├── prisma/
│   └── schema.prisma    # Database schema
├── dist/                # Compiled JavaScript
├── .env                 # Environment variables
└── package.json         # Dependencies
```

## Best Practices

1. **Stock Verification**: System validates stock availability before transactions
2. **Audit Trail**: All stock movements are logged with timestamps
3. **Price Tiering**: Flexible pricing supports multiple customer types and quantities
4. **Error Handling**: Comprehensive validation and error responses
5. **Security**: JWT authentication with role-based access control
6. **Database Transactions**: Multi-step operations are atomic

## Future Enhancements

- Report generation (sales, inventory, revenue)
- Receipt printing
- Barcode scanning integration
- Multi-location support
- Advanced analytics and dashboards
- Payment gateway integration
- Supplier management
- Return management system

## License

MIT

## Support

For issues or feature requests, please create an issue in the repository.
