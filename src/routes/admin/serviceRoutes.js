const express = require("express");
const router = express.Router();
const serviceController = require("../../controllers/admin/serviceController");

// Authentication routes
router.post("/create", serviceController.create);
router.get("/list", serviceController.list);
router.get("/is-service-code-unique", serviceController.isServiceCodeUnique);
router.get("/service-info", serviceController.getServiceById);
router.put("/update", serviceController.update);
router.delete("/delete", serviceController.delete);

module.exports = router;
