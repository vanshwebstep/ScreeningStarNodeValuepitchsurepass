const express = require("express");
const router = express.Router();
const profileController = require("../../../controllers/admin/trashed/customerController");

// Profile routes
router.get("/list", profileController.list);
router.put("/restore", profileController.restore);
router.delete("/delete", profileController.delete);

module.exports = router;
