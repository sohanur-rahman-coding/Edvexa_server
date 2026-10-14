const express = require("express");
const cors = require("cors");
const dotenv = require("dotenv");

dotenv.config();

const authRoutes = require("./routes/authRoutes");
const productRoutes = require("./routes/productRoutes");
const inventoryRoutes = require("./routes/inventoryRoutes");
const orderRoutes = require("./routes/orderRoutes");
const { errorHandler } = require("./middlewares/errorHandler");

const app = express();

// Security and CORS configuration
app.use(
  cors({
    origin: (origin, callback) => {
      // Allow requests with no origin (like mobile apps, curl, or server-to-server)
      if (!origin) return callback(null, true);
      const allowedOrigins = [
        process.env.CLIENT_URL,
        "http://localhost:3000",
        "http://127.0.0.1:3000",
      ].filter(Boolean);
      return callback(null, true); // Allow during dev & testing
    },
    credentials: true,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization", "Idempotency-Key", "idempotency-key"],
  })
);

app.use(express.json());

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
