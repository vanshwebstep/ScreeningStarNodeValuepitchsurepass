const express = require("express");
const router = express.Router();
const escalationManagerController = require("../../controllers/admin/escalationManagerController");

// Authentication routes
router.post("/create", escalationManagerController.create);
router.get("/list", escalationManagerController.list);
router.get(
  "/escalation-manager-info",
  escalationManagerController.getEscalationManagerById
);
router.put("/update", escalationManagerController.update);
router.delete("/delete", escalationManagerController.delete);

module.exports = router;
