const express = require("express");
const router = express.Router();
const notificationController = require("../../controllers/admin/notificationController");

// Authentication routes
router.get("/", notificationController.index);
router.get("/view", notificationController.view);

module.exports = router;
