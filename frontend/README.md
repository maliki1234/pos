# POS Frontend - Offline-First Application

A modern Point of Sale frontend built with Next.js, featuring complete offline-first functionality using IndexedDB and service workers.

## Features

### Offline-First Architecture
- **IndexedDB Storage**: All data is cached locally using Dexie.js
- **Service Worker**: Handles offline detection and fallback caching
- **Background Sync**: Automatically syncs pending transactions when online
- **Sync Queue**: Tracks failed operations and retries with exponential backoff

### Role-Based Workflows
- **Cashier**: Fast transaction processing with product search
- **Manager**: Inventory and transaction management
- **Admin**: Full system administration and reporting

### Core Functionality
- Product search and browsing
- Shopping cart with real-time calculations
- Multiple payment methods (Cash/Card)
- Transaction history with sync status
- Customer management
- Inventory tracking
- Real-time analytics dashboard

## Technology Stack

- **Frontend Framework**: Next.js 14
- **State Management**: Zustand (lightweight, offline-friendly)
- **Local Storage**: Dexie.js (IndexedDB wrapper)
- **HTTP Client**: Axios with automatic retry
- **Styling**: Tailwind CSS
- **UI Components**: React Icons
- **Notifications**: React Toastify
- **Charts**: Recharts

## Getting Started

### Installation

```bash
# Install dependencies
npm install

# Create .env.local
cp .env.example .env.local
```

### Configuration

Edit `.env.local`:

```env
NEXT_PUBLIC_API_URL=http://localhost:3000/api/v1
NEXT_PUBLIC_APP_NAME=POS System
NEXT_PUBLIC_ENABLE_OFFLINE_FIRST=true
```

### Development

```bash
# Start development server
npm run dev

# Open http://localhost:3000
```

### Build for Production

```bash
# Build
npm run build

# Start production server
npm start
```

## Architecture Overview

### State Management

The app uses Zustand stores for managing state:

1. **useAuthStore** (`src/stores/useAuthStore.ts`)
   - User authentication and session management
   - Persists to IndexedDB and localStorage

2. **useProductsStore** (`src/stores/useProductsStore.ts`)
   - Product caching and search
   - Auto-sync from backend

3. **useCartStore** (`src/stores/useCartStore.ts`)
   - Current transaction cart
   - Stores to localStorage for persistence

4. **useSyncStore** (`src/stores/useSyncStore.ts`)
   - Online/offline status tracking
   - Manages sync queue and retries

### Database Schema (IndexedDB)

Tables managed by Dexie:

```typescript
// Products
{
  id: string          // Primary key
  sku: string         // Product SKU
  name: string        // Product name
  category: string    // Category
  retailPrice: number
  wholesalePrice: number
  stock: number
  reorderLevel: number
  unit: string
  description?: string
  lastSynced: number  // Last sync timestamp
}

// Transactions
{
  id: string                    // Primary key (offlineId when offline)
  transactionNo: string         // Transaction number
  customerId?: string
  items: CartItem[]
  subtotal: number
  discountAmount: number
  taxAmount: number
  totalAmount: number
  paymentMethod: 'CASH' | 'CARD'
  paymentStatus: string
  notes?: string
  isVoided: boolean
  createdAt: number
  syncStatus: 'OFFLINE' | 'PENDING' | 'SYNCED' | 'FAILED'
  offlineId: string             // Temporary ID for conflict resolution
  syncedAt?: number             // Timestamp when synced
  syncedTransactionNo?: string  // Server transaction ID after sync
}

// Sync Queue
{
  id: string           // Primary key
  type: 'TRANSACTION'  // Type of operation
  action: 'CREATE'     // Action type
  data: any            // Payload to sync
  createdAt: number
  attempts: number     // Retry count
  lastError?: string   // Last error message
}

// User Session
{
  id: 'current'
  token: string
  user: {
    id: string
    email: string
    name: string
    role: 'ADMIN' | 'MANAGER' | 'CASHIER'
  }
}
```

### Offline-First Flow

1. **User Opens App**
   - Service Worker registered
   - IndexedDB initialized
   - Session restored from storage

2. **User Goes Offline**
   - Online status tracked via navigator.onLine
   - New transactions saved to IndexedDB with `syncStatus: 'OFFLINE'`
   - Added to sync queue for later processing

3. **Viewing Data Offline**
   - Products fetched from cached IndexedDB
   - Transactions displayed from local storage
   - Search works on cached products

4. **Coming Back Online**
   - `window.online` event triggers sync
   - Background sync processes sync queue
   - Pending transactions sent with retry logic
   - Failed items get exponential backoff

### API Integration

The `src/lib/apiClient.ts` handles API communication:

```typescript
// Example: Getting products
const products = await apiClient.getProducts();
// - Tries API first
// - Falls back to IndexedDB if offline
// - Auto-caches successful responses

// Example: Creating transaction
const transaction = await apiClient.createTransaction(data);
// - Sends to API if online
// - Queues for sync if offline
// - Returned transaction includes offlineId
```

### Sync Strategy

**Conflict Resolution**: Last-write-wins
- Server-side timestamp is authoritative
- Client transactions use offlineId for temporary identification
- Server returns official transactionNo after sync

**Retry Logic**:
- Max 3 attempts per item
- Exponential backoff between retries
- Failed items stay in queue for manual retry
- Old completed syncs auto-cleaned after 7 days

## UI Pages

### Authentication
- **Login** (`/`) - Credentials-based login with demo accounts

### Cashier Interface
- **POS** (`/dashboard/cashier`) - Main transaction processing
  - Product search and selection
  - Shopping cart management
  - Real-time calculations
  - Offline support indicator

### Management
- **Products** (`/dashboard/products`) - Product catalog
- **Customers** (`/dashboard/customers`) - Customer database
- **Transactions** (`/dashboard/transactions`) - History and sync status
- **Reports** (`/dashboard/reports`) - Analytics dashboard

## Demo Accounts

```
Admin:   admin@pos.com / admin123
Manager: manager@pos.com / manager123
Cashier: cashier@pos.com / cashier123
```

## Deployment

### Docker

```dockerfile
FROM node:18-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
RUN npm run build

FROM node:18-alpine
WORKDIR /app
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/public ./public
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./
EXPOSE 3000
CMD ["npm", "start"]
```

### Vercel

```bash
npm i -g vercel
vercel --env NEXT_PUBLIC_API_URL=<your-api-url>
```

## Troubleshooting

### Service Worker Issues
- Clear browser cache: DevTools → Application → Clear site data
- Check: DevTools → Application → Service Workers

### Sync Not Working
- Check online status via browser console: `navigator.onLine`
- Verify API URL in `.env.local`
- Check sync queue in IndexedDB

### Performance
- IndexedDB queries are instant (<10ms)
- Service worker caching reduces load
- Consider pagination for large datasets

## Development

### TypeScript
```bash
npm run type-check
```

### Linting
```bash
npm run lint
```

### Folder Structure
```
src/
├── app/                 # Next.js pages
├── components/          # React components
├── lib/                 # Utilities (API, DB, SW)
├── stores/              # Zustand stores
└── styles/              # Global styles
```

## Performance Tips

1. **Product Search**: Type product name → Auto-search from cache
2. **Transactions**: Upload happens automatically when online
3. **Data Refresh**: Pull to refresh in 30-second intervals
4. **Cache Management**: Older data auto-cleaned after 30 days

## Security Notes

- Auth tokens stored in IndexedDB and localStorage
- Service worker verification: DevTools → Application
- CORS configured for API communication
- Sensitive data not cached in service worker

## Future Improvements

- [ ] Biometric authentication (fingerprint)
- [ ] Barcode scanning
- [ ] Receipt printing
- [ ] Multi-language support
- [ ] Real-time inventory sync
- [ ] Advanced reporting
- [ ] Customer analytics
- [ ] Promotional campaigns

## License

MIT

## Support

For issues or questions, contact the development team or check backend documentation.
