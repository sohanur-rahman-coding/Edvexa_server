const dns = require("node:dns");
try {
  dns.setServers(["1.1.1.1", "1.0.0.1", "8.8.8.8"]);
} catch (e) {
  // Ignore in environments where setting DNS servers is restricted
}

const { MongoClient, ServerApiVersion } = require("mongodb");
const dotenv = require("dotenv");

dotenv.config();

const uri = process.env.MONGODB_URI;
const dbName = process.env.DB_NAME || "edvexa_db";

if (!uri) {
  console.error("FATAL: MONGODB_URI is not set in environment variables.");
}

const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: false,
    deprecationErrors: true,
  },
  maxPoolSize: 50,
  minPoolSize: 5,
  connectTimeoutMS: 15000,
});

let dbInstance = null;

async function connectDB() {
  if (dbInstance) {
    return dbInstance;
  }
  try {
    await client.connect();
    dbInstance = client.db(dbName);
    console.log(`[Database] Connected to MongoDB Atlas: ${dbName}`);

    // Create Indexes for high-performance and consistency
    await createDatabaseIndexes(dbInstance);

    return dbInstance;
  } catch (error) {
    console.error("[Database] Connection failed:", error.message);
    throw error;
  }
}

async function createDatabaseIndexes(db) {
  try {
    // 1. Users collection: unique email
    await db.collection("users").createIndex({ email: 1 }, { unique: true });

    // 2. Products collection: title, category and stock indexes
    await db.collection("products").createIndex({ title: 1 });
    await db.collection("products").createIndex({ category: 1 });
    await db.collection("products").createIndex({ stock: 1 });
    await db.collection("products").createIndex({ price: 1 });

    // 3. Orders collection: customer index, status index, and idempotencyKey unique index (sparse)
    await db.collection("orders").createIndex({ customerId: 1 });
    await db.collection("orders").createIndex({ status: 1 });
    await db.collection("orders").createIndex(
      { idempotencyKey: 1 },
      { unique: true, sparse: true }
    );

    // 4. Idempotency records collection with TTL expiry (24 hours)
    await db.collection("idempotency_keys").createIndex(
      { key: 1 },
      { unique: true }
    );
    await db.collection("idempotency_keys").createIndex(
      { createdAt: 1 },
      { expireAfterSeconds: 86400 } // Auto-purge after 24 hours
    );

    console.log("[Database] Production indexes verified successfully.");
  } catch (err) {
    console.warn("[Database] Index setup warning:", err.message);
  }
}

function getDB() {
  if (!dbInstance) {
    throw new Error("Database not initialized. Call connectDB() first.");
  }
  return dbInstance;
}

function getClient() {
  return client;
}

async function closeDB() {
  if (client) {
    await client.close();
    dbInstance = null;
    console.log("[Database] Connection closed.");
  }
}

module.exports = {
  connectDB,
  getDB,
  getClient,
  closeDB,
};
