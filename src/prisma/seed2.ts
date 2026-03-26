// import { PrismaClient } from '@prisma/client';
// import bcryptjs from 'bcryptjs';

// const prisma = new PrismaClient();

// async function main() {
//   console.log('🌱 Seeding database...');

//   // Create users
//   const adminUser = await prisma.user.create({
//     data: {
//       email: 'admin@pos.com',
//       password: await bcryptjs.hash('admin123', 10),
//       name: 'Admin User',
//       role: 'ADMIN',
//     },
//   });

//   const managerUser = await prisma.user.create({
//     data: {
//       email: 'manager@pos.com',
//       password: await bcryptjs.hash('manager123', 10),
//       name: 'Manager User',
//       role: 'MANAGER',
//     },
//   });

//   const cashierUser = await prisma.user.create({
//     data: {
//       email: 'cashier@pos.com',
//       password: await bcryptjs.hash('cashier123', 10),
//       name: 'Cashier User',
//       role: 'CASHIER',
//     },
//   });

//   console.log('✓ Users created');

//   // Create customers
//   const retailCustomer = await prisma.customer.create({
//     data: {
//       name: 'John Doe - Retail',
//       email: 'john@retail.com',
//       phone: '1234567890',
//       customerType: 'RETAIL',
//     },
//   });

//   const wholesaleCustomer = await prisma.customer.create({
//     data: {
//       name: 'ABC Wholesale Ltd',
//       email: 'contact@abc-wholesale.com',
//       phone: '0987654321',
//       customerType: 'WHOLESALE',
//     },
//   });

//   console.log('✓ Customers created');

//   // Create products
//   const product1 = await prisma.product.create({
//     data: {
//       name: 'Laptop',
//       description: 'High-performance laptop',
//       sku: 'LAPTOP-001',
//       category: 'Electronics',
//     },
//   });

//   const product2 = await prisma.product.create({
//     data: {
//       name: 'Mouse',
//       description: 'Wireless mouse',
//       sku: 'MOUSE-001',
//       category: 'Accessories',
//     },
//   });

//   const product3 = await prisma.product.create({
//     data: {
//       name: 'Keyboard',
//       description: 'Mechanical keyboard',
//       sku: 'KEYBOARD-001',
//       category: 'Accessories',
//     },
//   });

//   console.log('✓ Products created');

//   // Initialize stock
//   await prisma.productStock.create({
//     data: {
//       productId: product1.id,
//       quantity: 50,
//       minThreshold: 5,
//       maxThreshold: 200,
//     },
//   });

//   await prisma.productStock.create({
//     data: {
//       productId: product2.id,
//       quantity: 150,
//       minThreshold: 20,
//       maxThreshold: 500,
//     },
//   });

//   await prisma.productStock.create({
//     data: {
//       productId: product3.id,
//       quantity: 100,
//       minThreshold: 15,
//       maxThreshold: 400,
//     },
//   });

//   console.log('✓ Stock initialized');

//   // Set prices for retail
//   await prisma.productPrice.create({
//     data: {
//       productId: product1.id,
//       customerType: 'RETAIL',
//       unitPrice: '1200.00',
//       costPrice: '900.00',
//       minQuantity: 1,
//       discount: 0,
//     },
//   });

//   await prisma.productPrice.create({
//     data: {
//       productId: product2.id,
//       customerType: 'RETAIL',
//       unitPrice: '25.00',
//       costPrice: '15.00',
//       minQuantity: 1,
//       discount: 0,
//     },
//   });

//   await prisma.productPrice.create({
//     data: {
//       productId: product3.id,
//       customerType: 'RETAIL',
//       unitPrice: '80.00',
//       costPrice: '50.00',
//       minQuantity: 1,
//       discount: 0,
//     },
//   });

//   // Set prices for wholesale
//   await prisma.productPrice.create({
//     data: {
//       productId: product1.id,
//       customerType: 'WHOLESALE',
//       unitPrice: '1000.00',
//       costPrice: '900.00',
//       minQuantity: 1,
//       discount: 5,
//     },
//   });

//   await prisma.productPrice.create({
//     data: {
//       productId: product1.id,
//       customerType: 'WHOLESALE',
//       unitPrice: '950.00',
//       costPrice: '900.00',
//       minQuantity: 5,
//       discount: 10,
//     },
//   });

//   await prisma.productPrice.create({
//     data: {
//       productId: product2.id,
//       customerType: 'WHOLESALE',
//       unitPrice: '18.00',
//       costPrice: '15.00',
//       minQuantity: 1,
//       discount: 5,
//     },
//   });

//   await prisma.productPrice.create({
//     data: {
//       productId: product3.id,
//       customerType: 'WHOLESALE',
//       unitPrice: '65.00',
//       costPrice: '50.00',
//       minQuantity: 1,
//       discount: 5,
//     },
//   });

//   console.log('✓ Prices set');

//   console.log('✅ Seeding completed successfully!');
//   console.log('\n📋 Demo credentials:');
//   console.log('Admin    - email: admin@pos.com, password: admin123');
//   console.log('Manager  - email: manager@pos.com, password: manager123');
//   console.log('Cashier  - email: cashier@pos.com, password: cashier123');
// }

// main()
//   .catch((e) => {
//     console.error('❌ Seeding failed:', e);
//     process.exit(1);
//   })
//   .finally(async () => {
//     await prisma.$disconnect();
//   });






import { PrismaClient } from '@prisma/client';
import bcryptjs from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding database...');

  // ======================
  // USERS (use upsert)
  // ======================
  const adminUser = await prisma.user.upsert({
    where: { email: 'admin@pos.com' },
    update: {},
    create: {
      email: 'admin@pos.com',
      password: await bcryptjs.hash('admin123', 10),
      name: 'Admin User',
      role: 'ADMIN',
    },
  });

  const managerUser = await prisma.user.upsert({
    where: { email: 'manager@pos.com' },
    update: {},
    create: {
      email: 'manager@pos.com',
      password: await bcryptjs.hash('manager123', 10),
      name: 'Manager User',
      role: 'MANAGER',
    },
  });

  const cashierUser = await prisma.user.upsert({
    where: { email: 'cashier@pos.com' },
    update: {},
    create: {
      email: 'cashier@pos.com',
      password: await bcryptjs.hash('cashier123', 10),
      name: 'Cashier User',
      role: 'CASHIER',
    },
  });

  console.log('✓ Users ready');

  // ======================
  // CATEGORIES
  // ======================
  const electronics = await prisma.category.upsert({
    where: { name: 'Electronics' },
    update: {},
    create: {
      name: 'Electronics',
      description: 'Electronic devices',
    },
  });

  const accessories = await prisma.category.upsert({
    where: { name: 'Accessories' },
    update: {},
    create: {
      name: 'Accessories',
      description: 'Computer accessories',
    },
  });

  console.log('✓ Categories ready');

  // ======================
  // CUSTOMERS
  // ======================
  const retailCustomer = await prisma.customer.upsert({
    where: { email: 'john@retail.com' },
    update: {},
    create: {
      name: 'John Doe - Retail',
      email: 'john@retail.com',
      phone: '1234567890',
      customerType: 'RETAIL',
    },
  });

  const wholesaleCustomer = await prisma.customer.upsert({
    where: { email: 'contact@abc-wholesale.com' },
    update: {},
    create: {
      name: 'ABC Wholesale Ltd',
      email: 'contact@abc-wholesale.com',
      phone: '0987654321',
      customerType: 'WHOLESALE',
    },
  });

  console.log('✓ Customers ready');

  // ======================
  // PRODUCTS
  // ======================
  const laptop = await prisma.product.create({
    data: {
      name: 'Laptop',
      description: 'High-performance laptop',
      barcode: 'LAPTOP-001',
      categoryId: electronics.id,
    },
  });

  const mouse = await prisma.product.create({
    data: {
      name: 'Mouse',
      description: 'Wireless mouse',
      barcode: 'MOUSE-001',
      categoryId: accessories.id,
    },
  });

  const keyboard = await prisma.product.create({
    data: {
      name: 'Keyboard',
      description: 'Mechanical keyboard',
      barcode: 'KEYBOARD-001',
      categoryId: accessories.id,
    },
  });

  console.log('✓ Products created');

  // ======================
  // STOCK (FIFO via batches)
  // ======================
  await prisma.stockBatch.createMany({
    data: [
      {
        productId: laptop.id,
        quantity: 50,
        unitCost: 900.00,
      },
      {
        productId: mouse.id,
        quantity: 150,
        unitCost: 15.00,
      },
      {
        productId: keyboard.id,
        quantity: 100,
        unitCost: 50.00,
      },
    ],
  });

  console.log('✓ Stock batches created');

  // ======================
  // PRICING
  // ======================
  await prisma.productPrice.createMany({
    data: [
      // RETAIL
      {
        productId: laptop.id,
        customerType: 'RETAIL',
        unitPrice: 1200.00,
        costPrice: 900.00,
        minQuantity: 1,
      },
      {
        productId: mouse.id,
        customerType: 'RETAIL',
        unitPrice: 25.00,
        costPrice: 15.00,
        minQuantity: 1,
      },
      {
        productId: keyboard.id,
        customerType: 'RETAIL',
        unitPrice: 80.00,
        costPrice: 50.00,
        minQuantity: 1,
      },

      // WHOLESALE
      {
        productId: laptop.id,
        customerType: 'WHOLESALE',
        unitPrice: 1000.00,
        costPrice: 900.00,
        minQuantity: 1,
        discount: 5,
      },
      {
        productId: laptop.id,
        customerType: 'WHOLESALE',
        unitPrice: 950.00,
        costPrice: 900.00,
        minQuantity: 5,
        discount: 10,
      },
      {
        productId: mouse.id,
        customerType: 'WHOLESALE',
        unitPrice: 18.00,
        costPrice: 15.00,
        minQuantity: 1,
        discount: 5,
      },
      {
        productId: keyboard.id,
        customerType: 'WHOLESALE',
        unitPrice: 65.00,
        costPrice: 50.00,
        minQuantity: 1,
        discount: 5,
      },
    ],
  });

  console.log('✓ Pricing ready');

  console.log('✅ Seeding completed!');
}

main()
  .catch((e) => {
    console.error('❌ Error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });