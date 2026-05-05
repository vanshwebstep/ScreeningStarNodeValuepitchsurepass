const express = require("express");
const router = express.Router();
const userHistoryController = require("../../controllers/admin/userHistoryController");

// Authentication routes
router.get("/", userHistoryController.index);
router.get("/activity", userHistoryController.activityList);
module.exports = router;
