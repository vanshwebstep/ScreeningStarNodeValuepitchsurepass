const express = require("express");
const router = express.Router();
const acknowledgementController = require("../../controllers/admin/acknowledgementController");

// Authentication routes
router.get("/list", acknowledgementController.list);
router.put("/send-notification", acknowledgementController.sendNotification);
router.get("/send-auto-notification", acknowledgementController.sendAutoNotification);

module.exports = router;
