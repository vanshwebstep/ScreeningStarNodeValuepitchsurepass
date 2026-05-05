const express = require("express");
const router = express.Router();
const vendorController = require("../../../controllers/admin/internal-storage/vendorController");

// Authentication routes
router.post("/create", vendorController.create);
router.post("/bulk/create", vendorController.bulkCreate);
router.get("/list", vendorController.list);
router.put("/update", vendorController.update);
router.delete("/delete", vendorController.delete);

module.exports = router;
