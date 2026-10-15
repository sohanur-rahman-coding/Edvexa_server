const { ObjectId } = require("mongodb");
const { getDB, getClient } = require("../config/db");
const {
  BadRequestError,
  NotFoundError,
  ForbiddenError,
  ConflictError,
} = require("../middlewares/errorHandler");

/**
 * Valid order status progression transitions
 */
const VALID_TRANSITIONS = {
  Pending: ["Confirmed", "Cancelled"],
  Confirmed: ["Shipped", "Cancelled"],
  Shipped: ["Delivered"],
  Delivered: [],
  Cancelled: [],
};

// POST /api/orders
// Atomically creates an order and deducts inventory with zero overselling
async function createOrder(req, res, next) {
  const client = getClient();
  const db = getDB();
  const session = client.startSession();

  try {
    const { items, shippingAddress, notes } = req.body;
    const idempotencyKey =
      req.headers["idempotency-key"] || req.body.idempotencyKey || null;

    if (!items || !Array.isArray(items) || items.length === 0) {
      throw new BadRequestError("Order must contain at least one item.");
    }

    // Validate shipping address
    if (
      !shippingAddress ||
      !shippingAddress.street ||
      !shippingAddress.city ||
      !shippingAddress.country
    ) {
      throw new BadRequestError(
        "Complete shipping address (street, city, country) is required."
      );
    }

    // Validate quantities
    for (const item of items) {
      if (!item.productId || !item.quantity || item.quantity <= 0) {
        throw new BadRequestError("Each item must have a valid productId and quantity >= 1.");
      }
    }

    // Check duplicate order by idempotency key inside orders collection as an extra safeguard
    if (idempotencyKey) {
      const existingOrder = await db.collection("orders").findOne({ idempotencyKey });
      if (existingOrder) {
        res.setHeader("X-Idempotent-Replay", "true");
        return res.status(200).json({
          success: true,
          message: "Existing order retrieved via idempotency key.",
          data: {
            ...existingOrder,
            id: existingOrder._id.toString(),
          },
        });
      }
    }

    let createdOrder = null;

    // Execute atomic checkout within an ACID Transaction
    try {
      await session.withTransaction(async () => {
        const orderItems = [];
        let subtotal = 0;

        for (const item of items) {
          const productObjectId = new ObjectId(item.productId);

          // Atomic deduction: only succeed if current stock >= item.quantity
          const product = await db.collection("products").findOneAndUpdate(
            { _id: productObjectId, stock: { $gte: item.quantity } },
            { $inc: { stock: -item.quantity } },
            { session, returnDocument: "after" }
          );

          if (!product) {
            // Either product not found or insufficient stock
            const existingProd = await db
              .collection("products")
              .findOne({ _id: productObjectId }, { session });

            if (!existingProd) {
              throw new NotFoundError(`Product '${item.productId}' was not found.`);
            } else {
              throw new BadRequestError(
                `Insufficient stock for '${existingProd.title}'. Available: ${existingProd.stock}, Requested: ${item.quantity}.`
              );
            }
          }

          const itemTotal = product.price * item.quantity;
          subtotal += itemTotal;

          orderItems.push({
            productId: product._id.toString(),
            title: product.title,
            imageUrl: product.imageUrl,
            price: product.price,
            quantity: item.quantity,
            totalPrice: itemTotal,
          });
        }

        const tax = Math.round(subtotal * 0.05 * 100) / 100; // 5% tax
        const shippingFee = subtotal > 100 ? 0 : 15; // Free shipping over $100
        const totalAmount = Math.round((subtotal + tax + shippingFee) * 100) / 100;

        const orderDoc = {
          customerId: req.user.id,
          customerName: req.user.name,
          customerEmail: req.user.email,
          items: orderItems,
          pricing: {
            subtotal,
            tax,
            shippingFee,
            total: totalAmount,
          },
          shippingAddress,
          notes: notes || "",
          status: "Pending",
          paymentStatus: "Paid (Simulated)",
          idempotencyKey,
          statusHistory: [
            {
              status: "Pending",
              timestamp: new Date(),
              note: "Order placed and inventory reserved.",
              updatedBy: req.user.name,
            },
          ],
          createdAt: new Date(),
          updatedAt: new Date(),
        };

        const insertResult = await db.collection("orders").insertOne(orderDoc, { session });
        orderDoc._id = insertResult.insertedId;
        createdOrder = orderDoc;
      });
    } catch (txError) {
      // If transaction is not supported in the current MongoDB setup, perform atomic compensation fallback
      if (
        txError.message?.includes("Transaction numbers are only allowed") ||
        txError.message?.includes("replica set")
      ) {
        console.warn("[Order] Fallback to compensation-based atomic reservation.");
        createdOrder = await executeFallbackAtomicCheckout(db, req.user, items, shippingAddress, notes, idempotencyKey);
      } else {
        throw txError;
      }
    }

    res.status(201).json({
      success: true,
      message: "Order placed successfully! Inventory reserved.",
      data: {
        ...createdOrder,
        id: createdOrder._id.toString(),
      },
    });
  } catch (error) {
    next(error);
  } finally {
    await session.endSession();
  }
}

/**
 * Fallback atomic checkout with guaranteed compensation rollback
 * Used if transactions are unavailable in non-replica environments
 */
async function executeFallbackAtomicCheckout(db, user, items, shippingAddress, notes, idempotencyKey) {
  const deductedItems = [];
  const orderItems = [];
  let subtotal = 0;

  try {
    for (const item of items) {
      const productObjectId = new ObjectId(item.productId);

      // Atomic conditional decrement
      const product = await db.collection("products").findOneAndUpdate(
        { _id: productObjectId, stock: { $gte: item.quantity } },
        { $inc: { stock: -item.quantity } },
        { returnDocument: "after" }
      );

      if (!product) {
        const existingProd = await db.collection("products").findOne({ _id: productObjectId });
        const available = existingProd ? existingProd.stock : 0;
        throw new BadRequestError(
          `Insufficient stock for '${existingProd ? existingProd.title : item.productId}'. Available: ${available}, Requested: ${item.quantity}.`
        );
      }

      deductedItems.push({ productId: productObjectId, quantity: item.quantity });

      const itemTotal = product.price * item.quantity;
      subtotal += itemTotal;

      orderItems.push({
        productId: product._id.toString(),
        title: product.title,
        imageUrl: product.imageUrl,
        price: product.price,
        quantity: item.quantity,
        totalPrice: itemTotal,
      });
    }

    const tax = Math.round(subtotal * 0.05 * 100) / 100;
    const shippingFee = subtotal > 100 ? 0 : 15;
    const totalAmount = Math.round((subtotal + tax + shippingFee) * 100) / 100;

    const orderDoc = {
      customerId: user.id,
      customerName: user.name,
      customerEmail: user.email,
      items: orderItems,
      pricing: {
        subtotal,
        tax,
        shippingFee,
        total: totalAmount,
      },
      shippingAddress,
      notes: notes || "",
      status: "Pending",
      paymentStatus: "Paid (Simulated)",
      idempotencyKey,
      statusHistory: [
        {
          status: "Pending",
          timestamp: new Date(),
          note: "Order placed and inventory reserved.",
          updatedBy: user.name,
        },
      ],
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const insertResult = await db.collection("orders").insertOne(orderDoc);
    orderDoc._id = insertResult.insertedId;
    return orderDoc;
  } catch (error) {
    // Compensating rollback for any items deducted before the error occurred
    for (const deducted of deductedItems) {
      await db
        .collection("products")
        .updateOne({ _id: deducted.productId }, { $inc: { stock: deducted.quantity } });
    }
    throw error;
  }
}

// GET /api/orders/my-orders (Customer Only)
async function getMyOrders(req, res, next) {
  try {
    const db = getDB();
    const orders = await db
      .collection("orders")
      .find({ customerId: req.user.id })
      .sort({ createdAt: -1 })
      .toArray();

    res.status(200).json({
      success: true,
      count: orders.length,
      data: orders.map((o) => ({
        ...o,
        id: o._id.toString(),
      })),
    });
  } catch (error) {
    next(error);
  }
}

// GET /api/orders (Admin Only)
async function getAllOrders(req, res, next) {
  try {
    const { status, search, page = 1, limit = 50 } = req.query;
    const db = getDB();
    const query = {};

    if (status && status !== "all") {
      query.status = status;
    }

    if (search && search.trim() !== "") {
      const regex = new RegExp(search.trim(), "i");
      query.$or = [
        { customerName: regex },
        { customerEmail: regex },
        { _id: ObjectId.isValid(search) ? new ObjectId(search) : null },
      ].filter(Boolean);
    }

    const pageNum = Math.max(1, parseInt(page, 10));
    const pageSize = Math.min(100, Math.max(1, parseInt(limit, 10)));
    const skip = (pageNum - 1) * pageSize;

    const total = await db.collection("orders").countDocuments(query);
    const orders = await db
      .collection("orders")
      .find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(pageSize)
      .toArray();

    // Summary statistics for dashboard
    const statsAgg = await db
      .collection("orders")
      .aggregate([
        {
          $group: {
            _id: "$status",
            count: { $sum: 1 },
            revenue: { $sum: "$pricing.total" },
          },
        },
      ])
      .toArray();

    const stats = {
      totalOrders: total,
      pending: 0,
      confirmed: 0,
      shipped: 0,
      delivered: 0,
      cancelled: 0,
      totalRevenue: 0,
    };

    statsAgg.forEach((s) => {
      const key = s._id?.toLowerCase();
      if (stats[key] !== undefined) {
        stats[key] = s.count;
      }
      if (s._id !== "Cancelled") {
        stats.totalRevenue += s.revenue || 0;
      }
    });

    stats.totalRevenue = Math.round(stats.totalRevenue * 100) / 100;

    res.status(200).json({
      success: true,
      total,
      page: pageNum,
      totalPages: Math.ceil(total / pageSize),
      stats,
      data: orders.map((o) => ({
        ...o,
        id: o._id.toString(),
      })),
    });
  } catch (error) {
    next(error);
  }
}

// GET /api/orders/:id
async function getOrderById(req, res, next) {
  try {
    const { id } = req.params;
    const db = getDB();

    const order = await db.collection("orders").findOne({ _id: new ObjectId(id) });
    if (!order) {
      throw new NotFoundError(`Order with ID '${id}' not found.`);
    }

    // Role check: Only the customer who placed the order or an Admin can view
    if (req.user.role !== "admin" && order.customerId !== req.user.id) {
      throw new ForbiddenError("You do not have permission to view this order.");
    }

    res.status(200).json({
      success: true,
      data: {
        ...order,
        id: order._id.toString(),
      },
    });
  } catch (error) {
    next(error);
  }
}

// PATCH /api/orders/:id/status (Admin Only)
// Advances order lifecycle: Pending -> Confirmed -> Shipped -> Delivered
async function updateOrderStatus(req, res, next) {
  try {
    const { id } = req.params;
    const { status, note } = req.body;

    if (!status) {
      throw new BadRequestError("Status is required.");
    }

    const db = getDB();
    const order = await db.collection("orders").findOne({ _id: new ObjectId(id) });
    if (!order) {
      throw new NotFoundError(`Order with ID '${id}' not found.`);
    }

    const currentStatus = order.status;
    const allowedNext = VALID_TRANSITIONS[currentStatus] || [];

    if (!allowedNext.includes(status)) {
      throw new BadRequestError(
        `Invalid status transition from '${currentStatus}' to '${status}'. Allowed transitions: [${allowedNext.join(", ")}].`
      );
    }

    // If transitioning to Cancelled by Admin, restore inventory
    if (status === "Cancelled" && currentStatus !== "Cancelled") {
      await restoreOrderInventory(db, order);
    }

    const newHistoryEntry = {
      status,
      timestamp: new Date(),
      note: note || `Status updated to ${status}.`,
      updatedBy: req.user.name,
    };

    const updatedOrder = await db.collection("orders").findOneAndUpdate(
      { _id: new ObjectId(id) },
      {
        $set: { status, updatedAt: new Date() },
        $push: { statusHistory: newHistoryEntry },
      },
      { returnDocument: "after" }
    );

    res.status(200).json({
      success: true,
      message: `Order status successfully transitioned from ${currentStatus} to ${status}.`,
      data: {
        ...updatedOrder,
        id: updatedOrder._id.toString(),
      },
    });
  } catch (error) {
    next(error);
  }
}

// POST /api/orders/:id/cancel (Customer for Pending/Confirmed, or Admin)
// Cancels order and atomically restores inventory
async function cancelOrder(req, res, next) {
  try {
    const { id } = req.params;
    const { reason } = req.body;
    const db = getDB();

    const order = await db.collection("orders").findOne({ _id: new ObjectId(id) });
    if (!order) {
      throw new NotFoundError(`Order with ID '${id}' not found.`);
    }

    // Only customer who owns the order or admin can cancel
    if (req.user.role !== "admin" && order.customerId !== req.user.id) {
      throw new ForbiddenError("You do not have permission to cancel this order.");
    }

    if (order.status === "Cancelled") {
      throw new BadRequestError("Order has already been cancelled.");
    }

    // Shipped or Delivered orders cannot be cancelled directly
    if (["Shipped", "Delivered"].includes(order.status)) {
      throw new BadRequestError(
        `Order cannot be cancelled because it is already '${order.status}'. Please contact support for returns.`
      );
    }

    // Atomically restore product inventory
    await restoreOrderInventory(db, order);

    const historyEntry = {
      status: "Cancelled",
      timestamp: new Date(),
      note: reason || `Order cancelled by ${req.user.role}: ${req.user.name}. Inventory restored.`,
      updatedBy: req.user.name,
    };

    const updatedOrder = await db.collection("orders").findOneAndUpdate(
      { _id: new ObjectId(id) },
      {
        $set: { status: "Cancelled", updatedAt: new Date() },
        $push: { statusHistory: historyEntry },
      },
      { returnDocument: "after" }
    );

    res.status(200).json({
      success: true,
      message: "Order successfully cancelled and inventory restored to stock.",
      data: {
        ...updatedOrder,
        id: updatedOrder._id.toString(),
      },
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Atomically increments product stock back when an order is cancelled
 */
async function restoreOrderInventory(db, order) {
  if (!order.items || order.items.length === 0) return;

  for (const item of order.items) {
    try {
      await db.collection("products").updateOne(
        { _id: new ObjectId(item.productId) },
        {
          $inc: { stock: item.quantity },
          $set: { updatedAt: new Date() },
        }
      );
    } catch (err) {
      console.error(
        `[Inventory Restore] Failed to restore stock for productId ${item.productId}:`,
        err.message
      );
    }
  }
}

/**
 * POST /api/orders/create-payment-intent
 * Creates a Stripe PaymentIntent with amount and idempotency metadata
 */
async function createStripePaymentIntent(req, res, next) {
  try {
    const { amount, currency = "usd", items, idempotencyKey } = req.body;

    if (!amount || Number(amount) <= 0) {
      throw new BadRequestError("A valid payment amount greater than 0 is required.");
    }

    const stripeSecretKey = process.env.STRIPE_SECRET_KEY;

    if (!stripeSecretKey || stripeSecretKey.includes("your_stripe_secret_key")) {
      // Return a simulated client secret for development / demo if keys aren't added yet
      return res.status(200).json({
        success: true,
        isSimulated: true,
        clientSecret: `simulated_pi_${Date.now()}_secret_${Math.random().toString(36).substring(2, 9)}`,
        publishableKey: process.env.STRIPE_PUBLISHABLE_KEY || "",
        message: "Stripe test mode (Simulated). Provide STRIPE_SECRET_KEY in server .env for live Stripe gateway.",
      });
    }

    const Stripe = require("stripe");
    const stripe = new Stripe(stripeSecretKey);

    const paymentIntent = await stripe.paymentIntents.create(
      {
        amount: Math.round(Number(amount) * 100), // Stripe expects amounts in cents
        currency,
        automatic_payment_methods: { enabled: true },
        metadata: {
          customerId: req.user?.id || req.user?._id?.toString() || "guest",
          customerEmail: req.user?.email || "customer@edvexa.com",
          idempotencyKey: idempotencyKey || "",
        },
      },
      idempotencyKey ? { idempotencyKey: `pi_${idempotencyKey}` } : undefined
    );

    res.status(200).json({
      success: true,
      isSimulated: false,
      clientSecret: paymentIntent.client_secret,
      publishableKey: process.env.STRIPE_PUBLISHABLE_KEY || "",
    });
  } catch (error) {
    next(error);
  }
}

module.exports = {
  createOrder,
  getMyOrders,
  getAllOrders,
  getOrderById,
  updateOrderStatus,
  cancelOrder,
  createStripePaymentIntent,
};

