const express = require("express");
const router = express.Router();
const clientController = require("../../../../controllers/customer/branch/trashed/clientApplicationController");

// Basic routes
router.get("/listings", clientController.list);
router.delete("/delete", clientController.delete);
router.put("/restore", clientController.restore);

module.exports = router;
