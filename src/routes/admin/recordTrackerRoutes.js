const express = require("express");
const router = express.Router();
const recordTrackerController = require("../../controllers/admin/recordTrackerController");

// Authentication routes
router.get("/", recordTrackerController.list);
router.get("/report", recordTrackerController.recordTracker);

module.exports = router;
