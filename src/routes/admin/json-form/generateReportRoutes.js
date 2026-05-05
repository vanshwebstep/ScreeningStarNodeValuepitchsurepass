const express = require("express");
const router = express.Router();
const generateReportController = require("../../../controllers/admin/json-form/generateReportController");

// Basic routes
router.get("/list", generateReportController.list);
router.get("/form-by-service-id", generateReportController.formByServiceId);
router.put("/update", generateReportController.update);

module.exports = router;
