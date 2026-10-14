const { getDB } = require("../config/db");
const { ConflictError, BadRequestError } = require("./errorHandler");

/**
 * Idempotency Middleware for Order Operations
 * Prevents race conditions and duplicate order placement on retries
 */
function idempotencyMiddleware(options = {}) {
  const { headerName = "idempotency-key", required = true } = options;

  return async (req, res, next) => {
    // Only apply idempotency to state-changing methods (POST, PUT, PATCH)
    if (!["POST", "PUT", "PATCH"].includes(req.method)) {
      return next();
    }

    const key = req.headers[headerName] || req.body?.idempotencyKey;

    if (!key) {
      if (required) {
        return next(
          new BadRequestError(
            `Missing '${headerName}' header. Idempotency key is required to prevent duplicate operations.`
          )
        );
      }
      return next();
    }

    try {
      const db = getDB();
      const idempotencyCollection = db.collection("idempotency_keys");

      // Check existing record
      const existing = await idempotencyCollection.findOne({ key });

      if (existing) {
        if (existing.status === "processing") {
          return next(
            new ConflictError(
              "A request with this idempotency key is currently processing. Please wait."
            )
          );
        }

        if (existing.status === "completed") {
          // Replay cached response
          res.setHeader("X-Idempotent-Replay", "true");
          return res.status(existing.statusCode || 200).json(existing.responseBody);
        }
      }

      // Claim key atomically with upsert / unique check
      try {
        await idempotencyCollection.insertOne({
          key,
          userId: req.user?.id || null,
          endpoint: req.originalUrl,
          status: "processing",
          createdAt: new Date(),
        });
      } catch (insertErr) {
        // Race condition caught: duplicate key was inserted in the same millisecond
        if (insertErr.code === 11000) {
          return next(
            new ConflictError(
              "Concurrent request detected with the same idempotency key. Request aborted to prevent duplicate state."
            )
          );
        }
        throw insertErr;
      }

      // Intercept res.send/res.json to record completed payload
      const originalJson = res.json.bind(res);

      res.json = function (body) {
        // Only save idempotency if response was successful (2xx)
        if (res.statusCode >= 200 && res.statusCode < 300) {
          idempotencyCollection
            .updateOne(
              { key },
              {
                $set: {
                  status: "completed",
                  statusCode: res.statusCode,
                  responseBody: body,
                  completedAt: new Date(),
                },
              }
            )
            .catch((err) =>
              console.error("[Idempotency] Failed to cache response:", err.message)
            );
        } else {
          // If the request failed with an error, remove the key so the user can fix the issue and retry
          idempotencyCollection
            .deleteOne({ key })
            .catch((err) =>
              console.error("[Idempotency] Failed to clean up key:", err.message)
            );
        }

        return originalJson(body);
      };

      next();
    } catch (error) {
      next(error);
    }
  };
}

module.exports = {
  idempotencyMiddleware,
};
