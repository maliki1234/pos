import { PrismaClient } from '@prisma/client'
import fs from 'fs'
import bcrypt from 'bcryptjs'

const prisma = new PrismaClient()

const raw = JSON.parse(fs.readFileSync('./leo (3).json', 'utf-8'))

async function main() {
  console.log("🚀 Starting full migration...")

  // =========================
  // 1. CREATE CATEGORIES
  // =========================
  const categoryMap = {}

  for (const cat of raw.Category) {
    const created = await prisma.category.create({
      data: {
        name: cat.name.trim(),
        isActive: true
      }
    })
    categoryMap[cat.id] = created.id
  }

  console.log("✅ Categories done")

  // =========================
  // 2. CREATE PRODUCTS
  // =========================
  for (const p of raw.Product) {
    const price = Number(p.price || 0)
    const cost = Math.round(price * 0.7)
    const wholesale = Math.round(price * 0.9)

    const product = await prisma.product.create({
      data: {
        id: p.id,
        name: p.name.trim(),
        barcode: p.barcode || undefined,
        categoryId: categoryMap[p.categoryId] || null,
        isActive: true
      }
    })

    // =========================
    // 3. CREATE PRICES
    // =========================
    await prisma.productPrice.createMany({
      data: [
        {
          productId: product.id,
          customerType: "RETAIL",
          unitPrice: price,
          costPrice: cost,
          minQuantity: 1
        },
        {
          productId: product.id,
          customerType: "WHOLESALE",
          unitPrice: wholesale,
          costPrice: cost,
          minQuantity: 10
        }
      ]
    })

    // =========================
    // 4. CREATE STOCK (FIFO)
    // =========================
    await prisma.stockBatch.create({
      data: {
        productId: product.id,
        quantity: Number(p.quantity || 0),
        quantityUsed: 0,
        unitCost: cost,
        receivedDate: new Date(p.createdAt || Date.now())
      }
    })
  }


  const adminPassword = await bcrypt.hash("admin123", 10)
const cashierPassword = await bcrypt.hash("cashier123", 10)

await prisma.user.upsert({
  where: { email: "admin@pos.com" },
  update: {},
  create: {
    name: "Admin",
    email: "admin@pos.com",
    password: adminPassword,
    role: "ADMIN",
    isActive: true
  }
})

await prisma.user.upsert({
  where: { email: "cashier@pos.com" },
  update: {},
  create: {
    name: "Cashier",
    email: "cashier@pos.com",
    password: cashierPassword,
    role: "CASHIER",
    isActive: true
  }
})

console.log("✅ Users seeded")




  console.log("✅ Products + Prices + Stock done")

  console.log("🎉 FULL MIGRATION COMPLETED")
}

main()
  .catch(e => {
    console.error("❌ ERROR:", e)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })