const express = require("express");
const router = express.Router();
const breakController = require("../../../controllers/admin/personal-manageer/breakController");

// Basic routes
router.post("/", breakController.create);
router.get("/", breakController.view);

module.exports = router;
