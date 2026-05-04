-- Scope stock batches to a store so each branch has independent inventory.
ALTER TABLE "stock_batches" ADD COLUMN "storeId" TEXT;

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

-- Attach existing stock to the business default store.
UPDATE "stock_batches" sb
SET "storeId" = (
  SELECT s."id"
  FROM "stores" s
  WHERE s."businessId" = p."businessId" AND s."isActive" = true
  ORDER BY s."isDefault" DESC, s."createdAt" ASC
  LIMIT 1
)
FROM "products" p
WHERE sb."productId" = p."id";

ALTER TABLE "stock_batches" ALTER COLUMN "storeId" SET NOT NULL;

CREATE INDEX "stock_batches_storeId_idx" ON "stock_batches"("storeId");

ALTER TABLE "stock_batches" DROP CONSTRAINT IF EXISTS "stock_batches_productId_batchNumber_key";

CREATE UNIQUE INDEX "stock_batches_productId_storeId_batchNumber_key"
ON "stock_batches"("productId", "storeId", "batchNumber");

ALTER TABLE "stock_batches"
ADD CONSTRAINT "stock_batches_storeId_fkey"
FOREIGN KEY ("storeId") REFERENCES "stores"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
