const express = require("express");
const router = express.Router();
const generateReportRoutes = require("./json-form/generateReportRoutes");
const backgroundVerificationRoutes = require("./json-form/backgroundVerificationRoutes");

// Authentication routes
router.use("/generate-report", generateReportRoutes);
router.use("/background-verification", backgroundVerificationRoutes);
module.exports = router;
