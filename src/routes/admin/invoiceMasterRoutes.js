const express = require("express");
const router = express.Router();
const invoiceMasterController = require("../../controllers/admin/invoiceMasterController");

// Authentication routes
router.post("/send-data", invoiceMasterController.sendData);
router.post("/update", invoiceMasterController.update);
router.get("/", invoiceMasterController.list);
router.delete("/delete", invoiceMasterController.delete);

module.exports = router;
