-- CreateTable recipes
CREATE TABLE IF NOT EXISTS "recipes" (
  "id"         TEXT NOT NULL,
  "businessId" TEXT NOT NULL,
  "productId"  INTEGER NOT NULL,
  "name"       TEXT NOT NULL,
  "yieldQty"   INTEGER NOT NULL DEFAULT 1,
  "notes"      TEXT,
  "isActive"   BOOLEAN NOT NULL DEFAULT true,
  "createdAt"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "recipes_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "recipes_businessId_name_key" ON "recipes"("businessId", "name");

-- CreateTable recipe_ingredients
CREATE TABLE IF NOT EXISTS "recipe_ingredients" (
  "id"       TEXT NOT NULL,
  "recipeId" TEXT NOT NULL,
  "productId" INTEGER NOT NULL,
  "quantity" DECIMAL(10,3) NOT NULL,
  "unit"     TEXT NOT NULL DEFAULT 'units',
  CONSTRAINT "recipe_ingredients_pkey" PRIMARY KEY ("id")
);

-- CreateTable production_runs
CREATE TABLE IF NOT EXISTS "production_runs" (
  "id"                TEXT NOT NULL,
  "businessId"        TEXT NOT NULL,
  "recipeId"          TEXT NOT NULL,
  "quantityProduced"  INTEGER NOT NULL,
  "extraCosts"        JSONB,
  "totalMaterialCost" DECIMAL(12,2) NOT NULL DEFAULT 0,
  "totalExtraCost"    DECIMAL(12,2) NOT NULL DEFAULT 0,
  "costPerUnit"       DECIMAL(12,2) NOT NULL DEFAULT 0,
  "notes"             TEXT,
  "producedAt"        TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "createdAt"         TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "production_runs_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "recipes" ADD CONSTRAINT "recipes_businessId_fkey"
  FOREIGN KEY ("businessId") REFERENCES "businesses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "recipes" ADD CONSTRAINT "recipes_productId_fkey"
  FOREIGN KEY ("productId") REFERENCES "products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "recipe_ingredients" ADD CONSTRAINT "recipe_ingredients_recipeId_fkey"
  FOREIGN KEY ("recipeId") REFERENCES "recipes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "recipe_ingredients" ADD CONSTRAINT "recipe_ingredients_productId_fkey"
  FOREIGN KEY ("productId") REFERENCES "products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "production_runs" ADD CONSTRAINT "production_runs_businessId_fkey"
  FOREIGN KEY ("businessId") REFERENCES "businesses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "production_runs" ADD CONSTRAINT "production_runs_recipeId_fkey"
  FOREIGN KEY ("recipeId") REFERENCES "recipes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
