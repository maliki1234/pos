# POS System - Quick Start Guide

## 📋 Overview

This is a production-ready Point of Sale (POS) system built with Node.js, Express, TypeScript, Prisma, and PostgreSQL. It features comprehensive wholesale/retail pricing logic and robust stock management.

## ✅ Project Structure Created

```
pos-system/
├── src/
│   ├── config/          # Configuration management
│   ├── controllers/      # Request handlers
│   │   ├── authController.ts
│   │   ├── productController.ts
│   │   ├── stockController.ts
│   │   ├── transactionController.ts
│   │   └── customerController.ts
│   ├── middleware/      # Express middleware
│   │   ├── auth.ts          # JWT authentication & authorization
│   │   └── errorHandler.ts  # Error handling
│   ├── routes/         # API routes
│   │   ├── authRoutes.ts
│   │   ├── productRoutes.ts
│   │   ├── stockRoutes.ts
│   │   ├── transactionRoutes.ts
│   │   └── customerRoutes.ts
│   ├── services/       # Business logic
│   │   ├── priceService.ts        # Wholesale/retail pricing
│   │   ├── stockService.ts        # Inventory management
│   │   └── transactionService.ts  # Order processing
│   ├── types/          # TypeScript types
│   │   └── index.ts
│   ├── utils/          # Utilities
│   │   ├── logger.ts       # Logging
│   │   └── errors.ts       # Custom error classes
│   ├── prisma/         # Database utilities
│   │   └── seed.ts         # Sample data
│   └── index.ts        # Application entry
├── prisma/
│   └── schema.prisma   # Database schema
├── .env                # Environment variables
├── .env.example        # Example env
├── package.json        # Dependencies
├── tsconfig.json       # TypeScript config
├── .eslintrc.json      # ESLint config
├── .prettierrc          # Prettier config
├── README.md           # API documentation
├── ARCHITECTURE.md     # System design
└── QUICK_START.md      # This file
```

## 🚀 Installation & Setup

### Prerequisites
- Node.js >= 16.x
- npm >= 8.x
- PostgreSQL >= 12.x
- Git (optional)

### Step 1: Install Dependencies

```bash
# Navigate to project directory
cd "path/to/pos-system"

# Install npm packages
npm install

# If npm install fails due to permissions on Windows:
# 1. Open PowerShell as Administrator
# 2. Navigate to the project directory
# 3. Run: npm install --force
```

### Step 2: Set Up Environment

```bash
# Copy environment template
cp .env.example .env

# Edit .env with your configuration
# Update these values:
DATABASE_URL=postgresql://username:password@localhost:5432/pos_system
JWT_SECRET=your-super-secret-key-change-in-production
PORT=3000
```

### Step 3: Database Setup

```bash
# Create PostgreSQL database
createdb pos_system

# Or using psql:
psql
# Inside psql:
CREATE DATABASE pos_system;
\q

# Run Prisma migrations
npm run prisma:migrate

# (Optional) Seed sample data
npm run seed
```

### Step 4: Start the Server

**Development Mode:**
```bash
npm run dev
```

**Production Mode:**
```bash
npm run build
npm start
```

Server will run at `http://localhost:3000`

## 📚 API Documentation

### Health Check
```bash
curl http://localhost:3000/health
```

### Authentication

**Register (Create User):**
```bash
curl -X POST http://localhost:3000/api/v1/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "user@example.com",
    "password": "password123",
    "name": "John Doe",
    "role": "CASHIER"
  }'
```

**Login:**
```bash
curl -X POST http://localhost:3000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "user@example.com",
    "password": "password123"
  }'
```

Response includes JWT token to use for authenticated requests.

### Using the Token

All other requests require the Authorization header:
```bash
curl -H "Authorization: Bearer YOUR_JWT_TOKEN" http://localhost:3000/api/v1/products
```

### Product Management

**Create Product:**
```bash
curl -X POST http://localhost:3000/api/v1/products \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Laptop",
    "sku": "LAPTOP-001",
    "category": "Electronics",
    "description": "High-performance laptop"
  }'
```

**List Products:**
```bash
curl -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  "http://localhost:3000/api/v1/products?category=Electronics&skip=0&take=50"
```

**Set Pricing:**
```bash
curl -X POST http://localhost:3000/api/v1/products/{productId}/pricing \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "customerType": "RETAIL",
    "unitPrice": 1200.00,
    "costPrice": 900.00,
    "minQuantity": 1,
    "discount": 0
  }'
```

### Customers

**Create Customer:**
```bash
curl -X POST http://localhost:3000/api/v1/customers \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "ABC Wholesale Ltd",
    "email": "contact@abc.com",
    "customerType": "WHOLESALE"
  }'
```

**List Customers:**
```bash
curl -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  "http://localhost:3000/api/v1/customers?customerType=WHOLESALE"
```

### Transactions (Sales)

**Create Transaction:**
```bash
curl -X POST http://localhost:3000/api/v1/transactions \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "customerId": "customer-uuid",
    "items": [
      {
        "productId": "product-uuid",
        "quantity": 2,
        "discount": 5.00
      }
    ],
    "paymentMethod": "CASH",
    "notes": "Regular customer"
  }'
```

**View Transaction:**
```bash
curl -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  "http://localhost:3000/api/v1/transactions/{transactionId}"
```

**Void Transaction:**
```bash
curl -X POST http://localhost:3000/api/v1/transactions/{transactionId}/void \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "reason": "Customer returned items"
  }'
```

### Stock Management

**Check Stock:**
```bash
curl -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  "http://localhost:3000/api/v1/stock/{productId}"
```

**Update Stock:**
```bash
curl -X POST http://localhost:3000/api/v1/stock/{productId} \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "quantity": 50,
    "movementType": "IN",
    "referenceNo": "PO-2024-001",
    "notes": "Restocking purchase order"
  }'
```

**Stock Movements:**
```bash
curl -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  "http://localhost:3000/api/v1/stock/{productId}/movements"
```

**Low Stock Alert:**
```bash
curl -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  "http://localhost:3000/api/v1/stock/low-stock?threshold=20"
```

## 💾 Database Schema

### Core Tables

1. **users** - Staff members with roles
2. **customers** - Retail and wholesale customers
3. **products** - Product catalog
4. **product_stocks** - Real-time inventory tracking
5. **product_prices** - Multi-tier pricing (retail/wholesale)
6. **transactions** - Sales orders
7. **transaction_items** - Line items per transaction
8. **stock_movements** - Audit trail for inventory

## 🔐 Demo Credentials (After Seeding)

```
Admin User:
  Email: admin@pos.local
  Password: admin123
  Role: ADMIN

Manager:
  Email: manager@pos.local
  Password: manager123
  Role: MANAGER

Cashier:
  Email: cashier@pos.local
  Password: cashier123
  Role: CASHIER
```

## 🏗️ Key Features

### ✅ Wholesale vs Retail Pricing
- Separate price tiers for different customer types
- Quantity-based discounts for wholesale
- Automatic price tier selection based on order quantity

### ✅ Stock Management
- Real-time inventory tracking
- Stock movement audit trail
- Low stock alerts
- Prevents overselling

### ✅ Transaction Processing
- Multi-item orders
- Automatic tax calculation
- Unique transaction numbering
- Payment tracking
- Transaction voiding with stock restoration

### ✅ Security
- JWT-based authentication
- Role-based access control
- Password hashing
- Input validation
- CORS protection

### ✅ Scalability
- Modular architecture
- Service-oriented design
- Database indexing
- Pagination support

## 🛠️ Available Commands

```bash
# Development
npm run dev              # Start development server with auto-reload

# Building
npm run build            # Compile TypeScript to JavaScript
npm run type-check       # Check TypeScript for errors

# Database
npm run prisma:migrate   # Run database migrations
npm run prisma:studio    # Open Prisma Studio (GUI)
npm run seed             # Populate with sample data

# Code Quality
npm run lint             # Run ESLint

# Production
npm start                # Run compiled JavaScript
```

## 📊 System Architecture

```
┌─────────────────────────────┐
│    API Client (Postman)     │
└──────────────┬──────────────┘
               │ HTTP
┌──────────────▼──────────────┐
│   Express Server (Node.js)  │
│                             │
│  ├─ Middleware (Auth/Cors)  │
│  ├─ Routes                  │
│  ├─ Controllers             │
│  └─ Error Handling          │
└──────────────┬──────────────┘
               │
┌──────────────▼──────────────┐
│   Service Layer             │
│                             │
│  ├─ PriceService            │
│  ├─ StockService            │
│  └─ TransactionService      │
└──────────────┬──────────────┘
               │
┌──────────────▼──────────────┐
│   Prisma ORM                │
└──────────────┬──────────────┘
               │
┌──────────────▼──────────────┐
│   PostgreSQL Database       │
└─────────────────────────────┘
```

## 🐛 Troubleshooting

### npm install fails
- Try with `--force` flag: `npm install --force`
- Clear cache: `npm cache clean --force`
- On Windows, run as Administrator

### Port 3000 already in use
```bash
# Change PORT in .env
PORT=3001
```

### Database connection fails
```bash
# Verify PostgreSQL is running
# Windows: Check Services
# Mac/Linux: sudo systemctl status postgresql

# Check connection string in .env
DATABASE_URL=postgresql://user:password@localhost:5432/pos_system
```

### Migration fails
```bash
# Reset database (caution: deletes all data)
npm run prisma:migrate reset

# Or manually:
prisma migrate diff --from-empty --script > migration.sql
psql pos_system < migration.sql
```

## 📖 Additional Documentation

- [API Documentation](./README.md) - Complete API reference
- [Architecture Guide](./ARCHITECTURE.md) - System design deep dive
- [Prisma Docs](https://www.prisma.io/docs/) - ORM documentation

## 🤝 Project Features Summary

| Feature | Status | Details |
|---------|--------|---------|
| Product Management | ✅ | Create, read, update products |
| Wholesale Pricing | ✅ | Volume-based discounts |
| Retail Pricing | ✅ | Fixed prices with optional discount |
| Stock Management | ✅ | Real-time tracking, low-stock alerts |
| Transactions | ✅ | Multi-item orders, void support |
| Authentication | ✅ | JWT with role-based access |
| Customer Mgmt | ✅ | Retail & wholesale classification |
| Reporting | 📋 | Future enhancement |
| Barcode Scanning | 📋 | Future enhancement |
| Multi-location | 📋 | Future enhancement |

Legend: ✅ = Implemented | 📋 = Planned

## 💡 Tips for Production

1. **Environment Variables**: Use strong JWT_SECRET
2. **Database**: Enable SSL connections to PostgreSQL
3. **Logging**: Configure LOG_LEVEL to 'error' or 'info'
4. **Rate Limiting**: Add rate limiter middleware for API
5. **Backup**: Regular PostgreSQL backups
6. **Monitoring**: Implement error tracking (Sentry, etc)
7. **HTTPS**: Deploy behind reverse proxy with SSL

## 📞 Support

For issues or questions:
1. Check ARCHITECTURE.md for system design
2. Review README.md for API details
3. Check .env.example for configuration options
4. Review error messages in API responses

## 📄 License

MIT

---

**Happy selling! 🎉**
