const express = require("express");
const router = express.Router();
const teamManagementController = require("../../controllers/admin/teamManagementController");

// Authentication routes
router.get("/application-by-id", teamManagementController.applicationByID);
router.put("/generate-report", teamManagementController.generateReport);
router.post("/upload", teamManagementController.upload);

module.exports = router;
