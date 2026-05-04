-- Scope products to a store so each branch can have its own product catalog.
ALTER TABLE "products" ADD COLUMN "storeId" TEXT;

-- Backfill a default store for any legacy business that somehow has no store.
INSERT INTO "stores" ("id", "businessId", "name", "isDefault", "isActive", "createdAt", "updatedAt")
SELECT
  substr(md5(b."id"), 1, 8) || '-' ||
  substr(md5(b."id"), 9, 4) || '-' ||
  substr(md5(b."id"), 13, 4) || '-' ||
  substr(md5(b."id"), 17, 4) || '-' ||
  substr(md5(b."id"), 21, 12),
  b."id",
  'Main Store',
  true,
  true,
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
FROM "businesses" b
WHERE NOT EXISTS (
  SELECT 1 FROM "stores" s WHERE s."businessId" = b."id" AND s."isActive" = true
);

-- Attach existing products to each business default store.
UPDATE "products" p
SET "storeId" = (
  SELECT s."id"
  FROM "stores" s
  WHERE s."businessId" = p."businessId" AND s."isActive" = true
  ORDER BY s."isDefault" DESC, s."createdAt" ASC
  LIMIT 1
);

ALTER TABLE "products" ALTER COLUMN "storeId" SET NOT NULL;

ALTER TABLE "products" DROP CONSTRAINT IF EXISTS "products_businessId_barcode_key";

CREATE UNIQUE INDEX "products_businessId_storeId_barcode_key"
ON "products"("businessId", "storeId", "barcode");

CREATE INDEX "products_storeId_idx" ON "products"("storeId");

ALTER TABLE "products"
ADD CONSTRAINT "products_storeId_fkey"
FOREIGN KEY ("storeId") REFERENCES "stores"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
