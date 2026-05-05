const express = require("express");
const router = express.Router();
const reportMasterController = require("../../controllers/admin/reportMasterController");

// Authentication routes
router.get("/application-tracker", reportMasterController.applicationTracker);
router.get("/prepare-report", reportMasterController.prepareReport);
module.exports = router;
