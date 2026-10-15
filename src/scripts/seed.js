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

  // 2. Seed 20 Rich Catalog Products
  console.log("[Seeder] Seeding 20 Products with diverse stock and categories...");
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
      stock: 4, // LOW STOCK
      category: "Wearables",
      imageUrl: "https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=800&auto=format&fit=crop&q=80",
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    {
      title: "Sony PlayStation 5 Pro Edition",
      description: "Next-gen gaming console with advanced ray tracing, 2TB high-speed SSD, and PlayStation Spectral Super Resolution (PSSR).",
      price: 699.99,
      stock: 1, // CRITICAL STOCK SCENARIO (concurrency test)
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
      stock: 0, // OUT OF STOCK SCENARIO
      category: "Audio",
      imageUrl: "https://images.unsplash.com/photo-1545454675-3531b543be5d?w=800&auto=format&fit=crop&q=80",
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    {
      title: "iPad Pro 13\" M4 Ultra Retina OLED",
      description: "Tandem OLED Ultra Retina XDR display, breakthrough M4 performance, pencil hover precision, and ultra-thin 5.1mm chassis.",
      price: 1299.0,
      stock: 15,
      category: "Tablets",
      imageUrl: "https://images.unsplash.com/photo-1544244015-0df4b3ffc6b0?w=800&auto=format&fit=crop&q=80",
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    {
      title: "Fujifilm X-T5 Mirrorless Digital Camera",
      description: "40.2MP non-stacked X-Trans 5 HR sensor, 5-axis in-body image stabilization, 6.2K 30p internal movie recording in classic dial body.",
      price: 1699.0,
      stock: 6,
      category: "Cameras",
      imageUrl: "https://images.unsplash.com/photo-1516035069371-29a1b244cc32?w=800&auto=format&fit=crop&q=80",
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    {
      title: "ASUS ROG Swift OLED 27\" 240Hz Gaming Monitor",
      description: "0.03ms response time, 1440p QHD OLED panel, anti-glare micro-texture coating, and custom heatsink for pure competitive esports.",
      price: 999.0,
      stock: 7,
      category: "Monitors",
      imageUrl: "https://images.unsplash.com/photo-1547658719-da2b51169166?w=800&auto=format&fit=crop&q=80",
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    {
      title: "Samsung 4TB 990 PRO PCIe 4.0 NVMe SSD",
      description: "Unrivaled read/write speeds up to 7450/6900 MB/s, integrated thermal guard heatsink, and Samsung Magician software optimization.",
      price: 349.99,
      stock: 32,
      category: "Storage",
      imageUrl: "https://images.unsplash.com/photo-1597872200969-2b65d56bd16b?w=800&auto=format&fit=crop&q=80",
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    {
      title: "Apple AirPods Pro (2nd Gen) USB-C",
      description: "Up to 2x more Active Noise Cancellation, Adaptive Audio, Transparency mode, Personalized Spatial Audio, and MagSafe charging case.",
      price: 249.0,
      stock: 40,
      category: "Audio",
      imageUrl: "https://images.unsplash.com/photo-1600294037681-c80b4cb5b434?w=800&auto=format&fit=crop&q=80",
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    {
      title: "Anker Prime 27,650mAh Power Bank 250W",
      description: "High-capacity power bank with smart digital display, dual USB-C PD 3.1 fast charging, and airline-safe 99.54Wh rating.",
      price: 179.99,
      stock: 20,
      category: "Accessories",
      imageUrl: "https://images.unsplash.com/photo-1609592424109-dd9892f1b177?w=800&auto=format&fit=crop&q=80",
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    {
      title: "Nintendo Switch OLED Model - White",
      description: "Vibrant 7-inch OLED screen, wide adjustable stand, enhanced audio, and 64GB internal storage for handheld and TV gaming.",
      price: 349.99,
      stock: 14,
      category: "Gaming",
      imageUrl: "https://images.unsplash.com/photo-1578301978693-85fa9c0320b9?w=800&auto=format&fit=crop&q=80",
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    {
      title: "LG C3 42\" 4K OLED Gaming Display",
      description: "Self-lit OLED pixels with infinite contrast, 120Hz refresh rate, Dolby Vision, NVIDIA G-Sync, and 4 dedicated HDMI 2.1 ports.",
      price: 896.99,
      stock: 3, // LOW STOCK
      category: "Monitors",
      imageUrl: "https://images.unsplash.com/photo-1593305841991-05c297ba4575?w=800&auto=format&fit=crop&q=80",
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    {
      title: "DJI Mini 4 Pro Drone Fly More Combo",
      description: "Under 249g ultra-lightweight drone, omnidirectional obstacle sensing, 4K/60fps HDR true vertical shooting, and 34-min flight time.",
      price: 1099.0,
      stock: 5, // LOW STOCK
      category: "Cameras",
      imageUrl: "https://images.unsplash.com/photo-1508614589041-895b88991e3e?w=800&auto=format&fit=crop&q=80",
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    {
      title: "CalDigit TS4 Thunderbolt 4 Dock 18-Port",
      description: "Universal workstation docking station with 98W host charging, 2.5GbE Ethernet, 8x USB ports, UHS-II SD card reader, and dual 6K display.",
      price: 399.95,
      stock: 11,
      category: "Accessories",
      imageUrl: "https://images.unsplash.com/photo-1588508065123-287b28e013da?w=800&auto=format&fit=crop&q=80",
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    {
      title: "Shure SM7B Dynamic Broadcast Vocal Microphone",
      description: "Legendary cardioid dynamic vocal microphone for studio recording, podcasting, and streaming with electromagnetic hum shielding.",
      price: 399.0,
      stock: 9,
      category: "Audio",
      imageUrl: "https://images.unsplash.com/photo-1590602847861-f357a9332bbc?w=800&auto=format&fit=crop&q=80",
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    {
      title: "Elgato Stream Deck MK.2 Studio Controller",
      description: "15 customizable LCD keys to trigger actions in apps, control audio, launch media clips, and automate broadcast workflows.",
      price: 149.99,
      stock: 28,
      category: "Accessories",
      imageUrl: "https://images.unsplash.com/photo-1550745165-9bc0b252726f?w=800&auto=format&fit=crop&q=80",
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
