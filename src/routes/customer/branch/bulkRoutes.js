const express = require("express");
const router = express.Router();
const bulkController = require("../../../controllers/customer/branch/bulkController");

// Basic routes
router.post("/create", bulkController.create);
router.get("/list", bulkController.list);
router.delete("/delete", bulkController.delete);

module.exports = router;
