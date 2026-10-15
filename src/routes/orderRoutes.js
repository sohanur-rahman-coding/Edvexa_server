const express = require("express");
const router = express.Router();
const orderController = require("../controllers/orderController");
const { authenticate, authorize } = require("../middlewares/auth");
const { idempotencyMiddleware } = require("../middlewares/idempotency");

// All order operations require valid authentication
router.use(authenticate);

// Customer endpoints
router.post(
  "/",
  idempotencyMiddleware({ required: false }),
  orderController.createOrder
);
router.post("/create-payment-intent", orderController.createStripePaymentIntent);
router.get("/my-orders", orderController.getMyOrders);
router.get("/:id", orderController.getOrderById);
router.post("/:id/cancel", orderController.cancelOrder);

// Admin-only order fulfillment pipeline endpoints
router.get("/", authorize("admin"), orderController.getAllOrders);
router.patch("/:id/status", authorize("admin"), orderController.updateOrderStatus);

module.exports = router;
