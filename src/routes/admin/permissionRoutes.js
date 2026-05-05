const express = require("express");
const router = express.Router();
const permissionController = require("../../controllers/admin/permissionController");

// Basic routes
router.get("/roles", permissionController.rolesList);
router.get("/list", permissionController.list);
router.put("/update", permissionController.update);

module.exports = router;
