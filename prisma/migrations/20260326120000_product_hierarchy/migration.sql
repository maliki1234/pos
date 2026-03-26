-- Create UnitLevel enum
CREATE TYPE "UnitLevel" AS ENUM ('CARTON', 'BLOCK', 'PIECE');

-- Add hierarchy fields to products
ALTER TABLE "products"
  ADD COLUMN IF NOT EXISTS "unitLevel"      "UnitLevel" NOT NULL DEFAULT 'PIECE',
  ADD COLUMN IF NOT EXISTS "conversionRate" INTEGER,
  ADD COLUMN IF NOT EXISTS "parentId"       INTEGER;

-- Self-referential FK
ALTER TABLE "products"
  ADD CONSTRAINT "products_parentId_fkey"
  FOREIGN KEY ("parentId") REFERENCES "products"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

-- Create stock_conversions table
CREATE TABLE IF NOT EXISTS "stock_conversions" (
  "id"            TEXT          NOT NULL,
  "businessId"    TEXT          NOT NULL,
  "fromProductId" INTEGER       NOT NULL,
  "toProductId"   INTEGER       NOT NULL,
  "quantityIn"    INTEGER       NOT NULL,
  "quantityOut"   INTEGER       NOT NULL,
  "costPerUnit"   DECIMAL(10,2) NOT NULL,
  "notes"         TEXT,
  "convertedAt"   TIMESTAMP(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "createdAt"     TIMESTAMP(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "stock_conversions_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "stock_conversions_businessId_idx"    ON "stock_conversions"("businessId");
CREATE INDEX IF NOT EXISTS "stock_conversions_fromProductId_idx" ON "stock_conversions"("fromProductId");
CREATE INDEX IF NOT EXISTS "stock_conversions_toProductId_idx"   ON "stock_conversions"("toProductId");

ALTER TABLE "stock_conversions"
  ADD CONSTRAINT "stock_conversions_businessId_fkey"
  FOREIGN KEY ("businessId") REFERENCES "businesses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "stock_conversions"
  ADD CONSTRAINT "stock_conversions_fromProductId_fkey"
  FOREIGN KEY ("fromProductId") REFERENCES "products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "stock_conversions"
  ADD CONSTRAINT "stock_conversions_toProductId_fkey"
  FOREIGN KEY ("toProductId") REFERENCES "products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
