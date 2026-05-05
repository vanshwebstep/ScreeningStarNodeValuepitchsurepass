const express = require("express");
const router = express.Router();
const myProfileController = require("../../controllers/admin/myProfileController");

// Authentication routes
router.get("/", myProfileController.index);
router.put("/update", myProfileController.update);
router.post("/upload", myProfileController.upload);

module.exports = router;
