const express = require("express");
const router = express.Router();
const utilsController = require("../controllers/utilsController");

// Authentication routes
router.post("/upload-image", utilsController.uploadImage);
router.post("/image-to-base", utilsController.imageUrlToBase);
router.get("/test", utilsController.test);

module.exports = router;
