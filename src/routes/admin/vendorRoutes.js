const express = require("express");
const router = express.Router();
const vendorController = require("../../controllers/admin/vendorController");

// Authentication routes
router.get("/create", vendorController.create);
router.get("/list", vendorController.list);
router.put("/update", vendorController.update);
router.delete("/delete", vendorController.delete);

module.exports = router;
