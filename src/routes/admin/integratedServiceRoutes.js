const express = require("express");
const router = express.Router();
const integratedServiceController = require("../../controllers/admin/integratedServiceController");

// Authentication routes
router.post("/create", integratedServiceController.create);
router.get("/list", integratedServiceController.list);
router.get("/integrated-service-info", integratedServiceController.getIntegratedServiceById);
router.put("/update", integratedServiceController.update);
router.delete("/delete", integratedServiceController.delete);

module.exports = router;
