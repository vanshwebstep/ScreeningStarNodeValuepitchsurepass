const express = require("express");
const router = express.Router();
const backgroundVerificationController = require("../../../controllers/admin/json-form/backgroundVerificationController");

// Basic routes
router.get("/list", backgroundVerificationController.list);
router.get("/form-by-service-id", backgroundVerificationController.formByServiceId);
router.put("/update", backgroundVerificationController.update);

module.exports = router;
