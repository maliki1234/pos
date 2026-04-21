# Deployment

This project is deployed as three pieces:

- PostgreSQL database on Render
- Express/Prisma backend on Render
- Next.js frontend on Render

## Production URLs

- Frontend: https://pos-frontend-v8q1.onrender.com
- Backend: https://pos-backend-s0mf.onrender.com
- Backend health check: https://pos-backend-s0mf.onrender.com/health

## Backend Service

Render service: `pos-backend`

Settings:

```text
Root Directory: .
Build Command: npm install --include=dev && npx prisma generate && npm run build
Start Command: npx prisma migrate deploy && npm start
Health Check Path: /health
```

Required environment variables:

```env
NODE_ENV=production
DATABASE_URL=<Render internal PostgreSQL URL>
JWT_SECRET=<strong secret>
JWT_EXPIRY=7d
LOG_LEVEL=info
CORS_ORIGIN=https://pos-frontend-v8q1.onrender.com
```

Optional payment and platform variables depend on the integrations enabled for each business.

## Frontend Service

Render service: `pos-frontend`

Settings:

```text
Root Directory: frontend
Build Command: npm install && npm run build
Start Command: npm start
```

Required environment variables:

```env
NEXT_PUBLIC_API_URL=https://pos-backend-s0mf.onrender.com/api/v1
NEXT_PUBLIC_APP_NAME=POS System
NEXT_PUBLIC_ENABLE_OFFLINE_FIRST=true
```

## Database Migrations

The backend start command runs:

```bash
npx prisma migrate deploy
```

This applies pending migrations before the API starts. For paid Render plans, this can be moved to a pre-deploy command.

## Verification

Run these before pushing deployment changes:

```bash
npm run type-check
npm run build
cd frontend
npm run type-check
npm run build
```

After deploy, check:

```text
https://pos-backend-s0mf.onrender.com/health
https://pos-frontend-v8q1.onrender.com
```
