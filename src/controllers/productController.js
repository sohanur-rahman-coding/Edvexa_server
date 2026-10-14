const { ObjectId } = require("mongodb");
const { getDB } = require("../config/db");
const { BadRequestError, NotFoundError } = require("../middlewares/errorHandler");

// GET /api/products
async function getProducts(req, res, next) {
  try {
    const {
      search,
      category,
      inStock,
      minPrice,
      maxPrice,
      sortBy = "newest",
      page = 1,
      limit = 20,
    } = req.query;

    const db = getDB();
    const query = {};

    // Search query on title, description or category
    if (search && search.trim() !== "") {
      const regex = new RegExp(search.trim(), "i");
      query.$or = [{ title: regex }, { description: regex }, { category: regex }];
    }

    // Category filter
    if (category && category !== "all") {
      query.category = category;
    }

    // Stock availability filter
    if (inStock === "true" || inStock === true) {
      query.stock = { $gt: 0 };
    }

    // Price range filters
    if (minPrice !== undefined || maxPrice !== undefined) {
      query.price = {};
      if (minPrice !== undefined && !isNaN(minPrice)) {
        query.price.$gte = parseFloat(minPrice);
      }
      if (maxPrice !== undefined && !isNaN(maxPrice)) {
        query.price.$lte = parseFloat(maxPrice);
      }
    }

    // Sorting
    let sortOptions = { createdAt: -1 };
    if (sortBy === "price_asc") sortOptions = { price: 1 };
    else if (sortBy === "price_desc") sortOptions = { price: -1 };
    else if (sortBy === "stock_asc") sortOptions = { stock: 1 };
    else if (sortBy === "title_asc") sortOptions = { title: 1 };

    const pageNum = Math.max(1, parseInt(page, 10));
    const pageSize = Math.min(100, Math.max(1, parseInt(limit, 10)));
    const skip = (pageNum - 1) * pageSize;

    const total = await db.collection("products").countDocuments(query);
    const products = await db
      .collection("products")
      .find(query)
      .sort(sortOptions)
      .skip(skip)
      .limit(pageSize)
      .toArray();

    // Map _id to id string for frontend ergonomics
    const formattedProducts = products.map((prod) => ({
      ...prod,
      id: prod._id.toString(),
      isAvailable: prod.stock > 0,
      stockStatus:
        prod.stock > 10
          ? "in_stock"
          : prod.stock > 0
          ? "low_stock"
          : "out_of_stock",
    }));

    res.status(200).json({
      success: true,
      total,
      page: pageNum,
      totalPages: Math.ceil(total / pageSize),
      data: formattedProducts,
    });
  } catch (error) {
    next(error);
  }
}

// GET /api/products/categories
async function getCategories(req, res, next) {
  try {
    const db = getDB();
    const categories = await db.collection("products").distinct("category");
    res.status(200).json({
      success: true,
      data: categories.filter(Boolean),
    });
  } catch (error) {
    next(error);
  }
}

// GET /api/products/:id
async function getProductById(req, res, next) {
  try {
    const { id } = req.params;
    const db = getDB();

    const product = await db.collection("products").findOne({ _id: new ObjectId(id) });
    if (!product) {
      throw new NotFoundError(`Product with ID '${id}' not found.`);
    }

    res.status(200).json({
      success: true,
      data: {
        ...product,
        id: product._id.toString(),
        isAvailable: product.stock > 0,
        stockStatus:
          product.stock > 10
            ? "in_stock"
            : product.stock > 0
            ? "low_stock"
            : "out_of_stock",
      },
    });
  } catch (error) {
    next(error);
  }
}

// POST /api/products (Admin Only)
async function createProduct(req, res, next) {
  try {
    const { title, description, price, stock, category, imageUrl } = req.body;

    if (!title || price === undefined || stock === undefined || !category) {
      throw new BadRequestError("Title, price, stock, and category are required fields.");
    }

    const numPrice = parseFloat(price);
    const numStock = parseInt(stock, 10);

    if (isNaN(numPrice) || numPrice < 0) {
      throw new BadRequestError("Price must be a positive number.");
    }

    if (isNaN(numStock) || numStock < 0) {
      throw new BadRequestError("Stock cannot be negative.");
    }

    const db = getDB();
    const newProduct = {
      title: title.trim(),
      description: description ? description.trim() : "",
      price: numPrice,
      stock: numStock,
      category: category.trim(),
      imageUrl: imageUrl || "https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=600&auto=format&fit=crop&q=80",
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const result = await db.collection("products").insertOne(newProduct);
    newProduct._id = result.insertedId;

    res.status(201).json({
      success: true,
      message: "Product created successfully",
      data: {
        ...newProduct,
        id: newProduct._id.toString(),
        isAvailable: newProduct.stock > 0,
      },
    });
  } catch (error) {
    next(error);
  }
}

// PUT /api/products/:id (Admin Only)
async function updateProduct(req, res, next) {
  try {
    const { id } = req.params;
    const { title, description, price, stock, category, imageUrl } = req.body;

    const db = getDB();
    const updateFields = { updatedAt: new Date() };

    if (title !== undefined) updateFields.title = title.trim();
    if (description !== undefined) updateFields.description = description.trim();
    if (category !== undefined) updateFields.category = category.trim();
    if (imageUrl !== undefined) updateFields.imageUrl = imageUrl.trim();

    if (price !== undefined) {
      const numPrice = parseFloat(price);
      if (isNaN(numPrice) || numPrice < 0) {
        throw new BadRequestError("Price must be a valid positive number.");
      }
      updateFields.price = numPrice;
    }

    if (stock !== undefined) {
      const numStock = parseInt(stock, 10);
      if (isNaN(numStock) || numStock < 0) {
        throw new BadRequestError("Stock cannot be negative.");
      }
      updateFields.stock = numStock;
    }

    const result = await db.collection("products").findOneAndUpdate(
      { _id: new ObjectId(id) },
      { $set: updateFields },
      { returnDocument: "after" }
    );

    if (!result) {
      throw new NotFoundError(`Product with ID '${id}' not found.`);
    }

    res.status(200).json({
      success: true,
      message: "Product updated successfully",
      data: {
        ...result,
        id: result._id.toString(),
        isAvailable: result.stock > 0,
      },
    });
  } catch (error) {
    next(error);
  }
}

// DELETE /api/products/:id (Admin Only)
async function deleteProduct(req, res, next) {
  try {
    const { id } = req.params;
    const db = getDB();

    const result = await db.collection("products").deleteOne({ _id: new ObjectId(id) });
    if (result.deletedCount === 0) {
      throw new NotFoundError(`Product with ID '${id}' not found.`);
    }

    res.status(200).json({
      success: true,
      message: "Product deleted successfully.",
    });
  } catch (error) {
    next(error);
  }
}

module.exports = {
  getProducts,
  getCategories,
  getProductById,
  createProduct,
  updateProduct,
  deleteProduct,
};
