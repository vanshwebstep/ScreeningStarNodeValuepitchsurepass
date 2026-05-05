const express = require("express");
const router = express.Router();
const reportCaseStatusController = require("../../../controllers/customer/branch/reportCaseStatusController");

// Basic routes
router.get("/list", reportCaseStatusController.list);
router.get(
  "/services-annexure-data",
  reportCaseStatusController.annexureDataByServiceIds
);
module.exports = router;
