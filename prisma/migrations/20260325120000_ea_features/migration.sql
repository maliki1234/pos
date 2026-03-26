-- AlterTable businesses: add eTIMS + M-Pesa config fields
ALTER TABLE "businesses"
  ADD COLUMN IF NOT EXISTS "etimsEnabled"        BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "etimsPin"            TEXT,
  ADD COLUMN IF NOT EXISTS "etimsBhfId"          TEXT,
  ADD COLUMN IF NOT EXISTS "mpesaEnabled"        BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "mpesaShortcode"      TEXT,
  ADD COLUMN IF NOT EXISTS "mpesaPasskey"        TEXT,
  ADD COLUMN IF NOT EXISTS "mpesaConsumerKey"    TEXT,
  ADD COLUMN IF NOT EXISTS "mpesaConsumerSecret" TEXT,
  ADD COLUMN IF NOT EXISTS "mpesaCallbackUrl"    TEXT;

-- AlterTable customers: add creditLimit
ALTER TABLE "customers"
  ADD COLUMN IF NOT EXISTS "creditLimit" DECIMAL(12,2);

-- AlterTable transactions: add payments JSON + mpesaRef
ALTER TABLE "transactions"
  ADD COLUMN IF NOT EXISTS "payments"  JSONB,
  ADD COLUMN IF NOT EXISTS "mpesaRef"  TEXT;
