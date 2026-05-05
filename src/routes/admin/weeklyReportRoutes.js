const express = require("express");
const router = express.Router();
const weeklyReportController = require("../../controllers/admin/weeklyReportController");

// Authentication routes
router.get("/", weeklyReportController.index);

module.exports = router;
