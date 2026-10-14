const app = require("./app");
const { connectDB, closeDB } = require("./config/db");

const PORT = process.env.PORT || 5000;

async function startServer() {
  try {
    // 1. Establish MongoDB connection and ensure indexes
    await connectDB();

    // 2. Start HTTP server
    const server = app.listen(PORT, () => {
      console.log(`[Server] Edvexa API running on port ${PORT}`);
      console.log(`[Server] Local URL: http://localhost:${PORT}`);
      console.log(`[Server] Health Check: http://localhost:${PORT}/health`);
    });

    // Graceful shutdown handling
    const shutdown = async (signal) => {
      console.log(`\n[Server] Received ${signal}. Gracefully shutting down...`);
      server.close(async () => {
        await closeDB();
        console.log("[Server] Closed HTTP server and database connections.");
        process.exit(0);
      });
    };

    process.on("SIGINT", () => shutdown("SIGINT"));
    process.on("SIGTERM", () => shutdown("SIGTERM"));
  } catch (error) {
    console.error("[Server] Startup failed:", error);
    process.exit(1);
  }
}

startServer();
