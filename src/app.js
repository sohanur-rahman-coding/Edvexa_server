const express = require("express");
const cors = require("cors");
const dotenv = require("dotenv");

dotenv.config();

const authRoutes = require("./routes/authRoutes");
const productRoutes = require("./routes/productRoutes");
const inventoryRoutes = require("./routes/inventoryRoutes");
const orderRoutes = require("./routes/orderRoutes");
const { errorHandler } = require("./middlewares/errorHandler");

const { connectDB } = require("./config/db");

const app = express();

// Security and CORS configuration (allows Vercel preview & production URLs)
app.use(
  cors({
    origin: (origin, callback) => {
      // Allow requests with no origin (like mobile apps, curl, or serverless invocation)
      if (!origin) return callback(null, true);
      // Allow the requesting origin so any Vercel domain or localhost can communicate securely
      return callback(null, origin);
    },
    credentials: true,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization", "Idempotency-Key", "idempotency-key"],
  })
);

app.use(express.json());

// Ensure database connection for serverless environments (Vercel)
app.use(async (req, res, next) => {
  try {
    await connectDB();
    next();
  } catch (err) {
    next(err);
  }
});

// API Health Check & Welcome
app.get("/", (req, res) => {
  res.status(200).json({
    success: true,
    name: "Edvexa E-Commerce & Inventory Management API",
    version: "1.0.0",
    status: "Healthy",
    endpoints: {
      auth: "/api/auth",
      products: "/api/products",
      inventory: "/api/inventory",
      orders: "/api/orders",
    },
  });
});

app.get("/health", (req, res) => {
  res.status(200).json({ status: "OK", timestamp: new Date() });
});

// Mount modular REST APIs
app.use("/api/auth", authRoutes);
app.use("/api/products", productRoutes);
app.use("/api/inventory", inventoryRoutes);
app.use("/api/orders", orderRoutes);

// Catch-all 404 handler for undefined routes
app.use((req, res, next) => {
  res.status(404).json({
    success: false,
    message: `API endpoint '${req.originalUrl}' not found on this server.`,
  });
});

// Global centralized error handler
app.use(errorHandler);

module.exports = app;
