const express = require("express");
const router = express.Router();
const billingEscalationsController = require("../../controllers/admin/billingEscalationController");

// Authentication routes
router.post("/create", billingEscalationsController.create);
router.get("/list", billingEscalationsController.list);
router.get(
  "billing-escalation-info",
  billingEscalationsController.getBillingEscalationById
);
router.put("/update", billingEscalationsController.update);
router.delete("/delete", billingEscalationsController.delete);

module.exports = router;
