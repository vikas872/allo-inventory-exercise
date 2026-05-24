import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  console.log("Seeding database...");

  // Clean up existing data for idempotency
  await prisma.reservation.deleteMany();
  await prisma.stock.deleteMany();
  await prisma.product.deleteMany();
  await prisma.warehouse.deleteMany();

  // Create Warehouses
  const w1 = await prisma.warehouse.create({
    data: { name: "East Coast Fulfillment", location: "New York, NY" },
  });
  const w2 = await prisma.warehouse.create({
    data: { name: "West Coast Hub", location: "Los Angeles, CA" },
  });

  // Create Products
  const p1 = await prisma.product.create({
    data: {
      name: "Limited Edition Mechanical Keyboard",
      description: "A premium 75% hot-swappable keyboard with custom tactile switches.",
      price: 249.99,
      imageUrl: "https://images.unsplash.com/photo-1595225476474-87563907a212?w=800&q=80",
    },
  });

  const p2 = await prisma.product.create({
    data: {
      name: "Wireless ANC Headphones",
      description: "Industry-leading noise cancellation and high-fidelity audio.",
      price: 349.00,
      imageUrl: "https://images.unsplash.com/photo-1618366712010-f4ae9c647dcb?w=800&q=80",
    },
  });

  const p3 = await prisma.product.create({
    data: {
      name: "Ultra-Lightweight Gaming Mouse",
      description: "Ergonomic 60g mouse with a 26K DPI optical sensor.",
      price: 129.50,
      imageUrl: "https://images.unsplash.com/photo-1615663245857-ac9310d5b1ff?w=800&q=80",
    },
  });

  // Create Stock
  // Intentionally leaving stock low to test concurrency
  await prisma.stock.createMany({
    data: [
      { productId: p1.id, warehouseId: w1.id, totalUnits: 1 }, // Only 1 left! High contention.
      { productId: p1.id, warehouseId: w2.id, totalUnits: 5 },
      { productId: p2.id, warehouseId: w1.id, totalUnits: 10 },
      { productId: p3.id, warehouseId: w2.id, totalUnits: 2 },
    ],
  });

  console.log("Database seeded successfully!");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
