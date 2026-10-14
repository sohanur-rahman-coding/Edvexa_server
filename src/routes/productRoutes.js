const express = require("express");
const router = express.Router();
const productController = require("../controllers/productController");
const { authenticate, authorize } = require("../middlewares/auth");

// Public catalog routes
router.get("/", productController.getProducts);
router.get("/categories", productController.getCategories);
router.get("/:id", productController.getProductById);

// Admin-only management routes
router.post("/", authenticate, authorize("admin"), productController.createProduct);
router.put("/:id", authenticate, authorize("admin"), productController.updateProduct);
router.delete("/:id", authenticate, authorize("admin"), productController.deleteProduct);

module.exports = router;
