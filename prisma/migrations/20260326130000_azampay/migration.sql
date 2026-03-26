ALTER TABLE "businesses"
  ADD COLUMN IF NOT EXISTS "azampayEnabled"      BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "azampayAppName"      TEXT,
  ADD COLUMN IF NOT EXISTS "azampayClientId"     TEXT,
  ADD COLUMN IF NOT EXISTS "azampayClientSecret" TEXT,
  ADD COLUMN IF NOT EXISTS "azampayCallbackUrl"  TEXT;
