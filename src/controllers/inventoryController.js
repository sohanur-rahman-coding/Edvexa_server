const { ObjectId } = require("mongodb");
const { getDB } = require("../config/db");
const { BadRequestError, NotFoundError } = require("../middlewares/errorHandler");

// GET /api/inventory (Admin Only)
async function getInventory(req, res, next) {
  try {
    const db = getDB();
    const products = await db.collection("products").find().sort({ stock: 1 }).toArray();

    let totalInventoryCount = 0;
    let lowStockCount = 0;
    let outOfStockCount = 0;

    const formatted = products.map((prod) => {
      totalInventoryCount += prod.stock || 0;
      if (prod.stock === 0) outOfStockCount++;
      else if (prod.stock <= 5) lowStockCount++;

      return {
        ...prod,
        id: prod._id.toString(),
        title: prod.title,
        description: prod.description || "",
        category: prod.category,
        price: prod.price,
        stock: prod.stock,
        imageUrl: prod.imageUrl || "https://images.unsplash.com/photo-1526738549149-8e07eca6c147?w=800&auto=format&fit=crop&q=80",
        isAvailable: prod.stock > 0,
        stockStatus:
          prod.stock > 10
            ? "in_stock"
            : prod.stock > 0
            ? "low_stock"
            : "out_of_stock",
        updatedAt: prod.updatedAt,
      };
    });

    res.status(200).json({
      success: true,
      stats: {
        totalProducts: products.length,
        totalInventoryCount,
        lowStockCount,
        outOfStockCount,
      },
      data: formatted,
    });
  } catch (error) {
    next(error);
  }
}

// POST /api/inventory/adjust (Admin Only)
// Adjusts stock level with atomic operations
async function adjustStock(req, res, next) {
  try {
    const { productId, operation = "set", amount } = req.body;

    if (!productId || amount === undefined) {
      throw new BadRequestError("productId and amount are required.");
    }

    const numAmount = parseInt(amount, 10);
    if (isNaN(numAmount)) {
      throw new BadRequestError("Amount must be a valid integer.");
    }

    const db = getDB();
    const product = await db.collection("products").findOne({ _id: new ObjectId(productId) });
    if (!product) {
      throw new NotFoundError(`Product with ID '${productId}' not found.`);
    }

    let updatedProduct;

    if (operation === "set") {
      if (numAmount < 0) {
        throw new BadRequestError("Stock cannot be set to a negative number.");
      }
      updatedProduct = await db.collection("products").findOneAndUpdate(
        { _id: new ObjectId(productId) },
        { $set: { stock: numAmount, updatedAt: new Date() } },
        { returnDocument: "after" }
      );
    } else if (operation === "increment") {
      if (numAmount < 0) {
        throw new BadRequestError("Increment amount must be positive.");
      }
      updatedProduct = await db.collection("products").findOneAndUpdate(
        { _id: new ObjectId(productId) },
        { $inc: { stock: numAmount }, $set: { updatedAt: new Date() } },
        { returnDocument: "after" }
      );
    } else if (operation === "decrement") {
      if (numAmount <= 0) {
        throw new BadRequestError("Decrement amount must be greater than zero.");
      }
      // Atomic guard to prevent stock from dropping below zero
      updatedProduct = await db.collection("products").findOneAndUpdate(
        { _id: new ObjectId(productId), stock: { $gte: numAmount } },
        { $inc: { stock: -numAmount }, $set: { updatedAt: new Date() } },
        { returnDocument: "after" }
      );

      if (!updatedProduct) {
        throw new BadRequestError(
          `Cannot decrement stock by ${numAmount}. Current stock is only ${product.stock}.`
        );
      }
    } else {
      throw new BadRequestError("Invalid operation. Must be 'set', 'increment', or 'decrement'.");
    }

    res.status(200).json({
      success: true,
      message: `Stock successfully updated for '${updatedProduct.title}'.`,
      data: {
        id: updatedProduct._id.toString(),
        title: updatedProduct.title,
        stock: updatedProduct.stock,
        isAvailable: updatedProduct.stock > 0,
        updatedAt: updatedProduct.updatedAt,
      },
    });
  } catch (error) {
    next(error);
  }
}

// GET /api/inventory/low-stock
async function getLowStockAlerts(req, res, next) {
  try {
    const threshold = parseInt(req.query.threshold, 10) || 5;
    const db = getDB();

    const lowStockProducts = await db
      .collection("products")
      .find({ stock: { $lte: threshold } })
      .sort({ stock: 1 })
      .toArray();

    res.status(200).json({
      success: true,
      threshold,
      count: lowStockProducts.length,
      data: lowStockProducts.map((p) => ({
        id: p._id.toString(),
        title: p.title,
        stock: p.stock,
        price: p.price,
        category: p.category,
      })),
    });
  } catch (error) {
    next(error);
  }
}

module.exports = {
  getInventory,
  adjustStock,
  getLowStockAlerts,
};
