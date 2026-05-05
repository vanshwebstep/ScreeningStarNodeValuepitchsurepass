const express = require("express");
const router = express.Router();
const clientAllocationController = require("../../controllers/admin/clientAllocationController");

// Authentication routes
router.get("/applications", clientAllocationController.applications);
router.post("/create", clientAllocationController.create);
router.post("/update", clientAllocationController.update);
router.post("/bulk/create", clientAllocationController.bulkCreate);
router.get("/list", clientAllocationController.list);
router.delete("/delete", clientAllocationController.delete);
module.exports = router;
