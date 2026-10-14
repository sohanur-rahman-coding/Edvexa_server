const express = require("express");
const router = express.Router();
const inventoryController = require("../controllers/inventoryController");
const { authenticate, authorize } = require("../middlewares/auth");

// All inventory routes are protected and restricted to Admin
router.use(authenticate, authorize("admin"));

router.get("/", inventoryController.getInventory);
router.post("/adjust", inventoryController.adjustStock);
router.get("/low-stock", inventoryController.getLowStockAlerts);

module.exports = router;
