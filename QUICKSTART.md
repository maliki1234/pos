# Quick Start Guide

## 🚀 Start the Complete System

### Prerequisites
- Node.js 18+
- PostgreSQL 12+

### Backend (Terminal 1)

```bash
cd "New folder"
npm install
npm run dev
# Backend running on http://localhost:3000
```

### Frontend (Terminal 2)

```bash
cd frontend
npm install
npm run dev
# Frontend running on http://localhost:3001
```

### Access Application

- **Frontend**: http://localhost:3001
- **Backend API**: http://localhost:3000/api/v1

### Demo Login

```
Email: cashier@pos.com
Password: cashier123
```

---

## 📋 Architecture

### Frontend (Offline-First)
- **Framework**: Next.js 14
- **Storage**: Dexie (IndexedDB)
- **State**: Zustand stores
- **Styling**: Tailwind CSS
- **Features**: Cashier UI, Admin Dashboard, Offline Mode

### Backend (REST API)
- **Framework**: Express.js
- **Database**: PostgreSQL + Prisma
- **Auth**: JWT
- **Features**: Multi-tier pricing, Stock management, Transactions

---

## 🎯 Main Features

### For Cashiers
- Fast product search
- Interactive shopping cart
- Multiple payment methods
- Offline transaction support
- Auto-sync when online

### For Managers
- Product management
- Inventory tracking
- Sales reports
- Customer management

### For Admins
- System administration
- User management
- Analytics dashboard
- Settings

---

## 🔄 Offline-First Workflow

1. **Browse Products** → Cached in IndexedDB
2. **Create Transaction** → Saved to IndexedDB with `syncStatus: OFFLINE`
3. **Go Online** → Auto-syncs in background
4. **View History** → All transactions visible

---

## 📱 Pages

### Authentication
- `/` - Login page

### Dashboard
- `/dashboard` - Main dashboard
- `/dashboard/cashier` - POS interface
- `/dashboard/products` - Product management
- `/dashboard/customers` - Customer management
- `/dashboard/transactions` - Transaction history
- `/dashboard/reports` - Analytics

---

## 🔧 Development Commands

### Backend
```bash
npm run dev       # Start dev server
npm run build     # Build for production
npm run seed      # Seed database
npm run lint      # Check code style
```

### Frontend
```bash
npm run dev       # Start dev server
npm run build     # Build for production
npm run lint      # Check code style
npm run type-check # Check TypeScript
```

---

## 💾 Database

### Reset Database
```bash
npx prisma migrate reset
npx prisma db seed
```

### View Data
```bash
npx prisma studio  # Opens visual database editor
```

---

## 🐛 Troubleshooting

| Issue | Solution |
|-------|----------|
| Port 3000 in use | `lsof -i :3000` then `kill -9 <PID>` |
| DB connection failed | Check DATABASE_URL in .env |
| Service worker cache stale | Clear DevTools → Application → Clear site data |
| API returns 401 | Re-login, session may be expired |
| Offline mode not working | Check Service Worker in DevTools → Application |

---

## 📚 Documentation

- **Full Setup**: See [SETUP.md](./SETUP.md)
- **Frontend Details**: See [frontend/README.md](./frontend/README.md)
- **Backend Details**: See [README.md](./README.md)

---

## 🚢 Deploy

### Frontend (Vercel)
```bash
cd frontend
vercel --env NEXT_PUBLIC_API_URL=<api-url>
```

### Backend (Heroku)
```bash
heroku create pos-api
heroku addons:create heroku-postgresql:standard-0
git push heroku main
```

---

## ✨ Key Details

- **Offline**: Yes - Works completely without internet
- **Sync**: Automatic - Syncs on reconnect
- **Auth**: JWT tokens - Persisted in IndexedDB
- **Cache**: Service worker + IndexedDB
- **Retry**: Exponential backoff for failed syncs
- **Speed**: <2s load time with cache

---

*Last Updated: 2024*
