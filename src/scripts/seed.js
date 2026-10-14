const bcrypt = require("bcryptjs");
const { connectDB, closeDB, getDB } = require("../config/db");

async function seed() {
  console.log("--- Starting Edvexa Database Seeder ---");
  await connectDB();
  const db = getDB();

  // 1. Seed Users
  console.log("[Seeder] Seeding Users (Admin & Customer)...");
  const usersCollection = db.collection("users");

  const salt = await bcrypt.genSalt(10);
  const adminPasswordHash = await bcrypt.hash("AdminPassword123!", salt);
  const customerPasswordHash = await bcrypt.hash("CustomerPassword123!", salt);

  const users = [
    {
      name: "Edvexa System Admin",
      email: "admin@edvexa.com",
      passwordHash: adminPasswordHash,
      role: "admin",
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    {
      name: "Alex Customer",
      email: "customer@edvexa.com",
      passwordHash: customerPasswordHash,
      role: "customer",
      createdAt: new Date(),
      updatedAt: new Date(),
    },
  ];

  for (const user of users) {
    await usersCollection.updateOne(
      { email: user.email },
      { $set: user },
      { upsert: true }
    );
  }
  console.log("[Seeder] Users seeded: admin@edvexa.com and customer@edvexa.com");

  // 2. Seed Products
  console.log("[Seeder] Seeding Products...");
  const productsCollection = db.collection("products");

  const products = [
    {
      title: "MacBook Pro 16\" M3 Max",
      description: "Apple M3 Max chip with 16-core CPU, 40-core GPU, 48GB unified memory, and 1TB SSD storage. Liquid Retina XDR display.",
      price: 3499.0,
      stock: 12,
      category: "Laptops",
      imageUrl: "https://images.unsplash.com/photo-1517336714731-489689fd1ca8?w=800&auto=format&fit=crop&q=80",
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    {
      title: "Sony WH-1000XM5 Wireless Headphones",
      description: "Industry-leading noise cancellation with two processors and 8 microphones. Crystal clear hands-free calling and 30-hour battery life.",
      price: 399.99,
      stock: 25,
      category: "Audio",
      imageUrl: "https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=800&auto=format&fit=crop&q=80",
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    {
      title: "Logitech MX Master 3S Wireless Mouse",
      description: "Quiet clicks, 8K DPI any-surface tracking, MagSpeed electromagnetic scrolling, and ergonomic design for all-day comfort.",
      price: 99.0,
      stock: 45,
      category: "Accessories",
      imageUrl: "https://images.unsplash.com/photo-1615663245857-ac93bb7c39e7?w=800&auto=format&fit=crop&q=80",
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    {
      title: "Apple Watch Ultra 2 (Titanium)",
      description: "Rugged and capable 49mm titanium case, precision dual-frequency GPS, up to 36 hours of battery life, and 100m water resistance.",
      price: 799.0,
      stock: 4, // LOW STOCK scenario
      category: "Wearables",
      imageUrl: "https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=800&auto=format&fit=crop&q=80",
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    {
      title: "Sony PlayStation 5 Pro Edition",
      description: "Next-gen gaming console with advanced ray tracing, 2TB high-speed SSD, and PlayStation Spectral Super Resolution (PSSR).",
      price: 699.99,
      stock: 1, // CONCURRENCY TEST & CRITICAL STOCK scenario (Only 1 available!)
      category: "Gaming",
      imageUrl: "https://images.unsplash.com/photo-1606813907291-d86efa9b94db?w=800&auto=format&fit=crop&q=80",
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    {
      title: "Dell UltraSharp 32\" 4K USB-C Hub Monitor",
      description: "IPS Black technology with 2000:1 contrast ratio, 98% DCI-P3 color coverage, 90W power delivery, and built-in RJ45 Ethernet.",
      price: 849.0,
      stock: 8,
      category: "Monitors",
      imageUrl: "https://images.unsplash.com/photo-1527443224154-c4a3942d3acf?w=800&auto=format&fit=crop&q=80",
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    {
      title: "Keychron Q1 Pro Wireless Mechanical Keyboard",
      description: "Custom mechanical keyboard with full aluminum CNC body, hot-swappable switches, double-gasket design, and QMK/VIA support.",
      price: 199.0,
      stock: 18,
      category: "Accessories",
      imageUrl: "https://images.unsplash.com/photo-1587829741301-dc798b83add3?w=800&auto=format&fit=crop&q=80",
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    {
      title: "Bose SoundLink Revolve+ II Bluetooth Speaker",
      description: "Deep, loud, immersive 360-degree sound. Durable, water and dust resistant (IP55) with up to 17 hours of battery life.",
      price: 329.0,
      stock: 0, // OUT OF STOCK scenario
      category: "Audio",
      imageUrl: "https://images.unsplash.com/photo-1545454675-3531b543be5d?w=800&auto=format&fit=crop&q=80",
      createdAt: new Date(),
      updatedAt: new Date(),
    },
  ];

  for (const prod of products) {
    await productsCollection.updateOne(
      { title: prod.title },
      { $set: prod },
      { upsert: true }
    );
  }
  console.log(`[Seeder] Seeded ${products.length} products successfully.`);

  console.log("--- Seeding Completed Successfully! ---");
  await closeDB();
}

if (require.main === module) {
  seed().catch((err) => {
    console.error("[Seeder] Error during seeding:", err);
    process.exit(1);
  });
}

module.exports = seed;
