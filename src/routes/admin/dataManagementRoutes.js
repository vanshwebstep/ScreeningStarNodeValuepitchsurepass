const express = require("express");
const router = express.Router();
const dataManagementController = require("../../controllers/admin/dataManagementController");

// Authentication routes
router.get("/list", dataManagementController.list);
router.get(
  "/branch-list-by-customer",
  dataManagementController.listByCustomerId
);
router.get(
  "/applications-by-branch",
  dataManagementController.applicationListByBranch
);
router.get("/application-by-id", dataManagementController.applicationByID);
router.put("/submit", dataManagementController.submit);

router.get(
  "/customer-info",
  dataManagementController.customerBasicInfoWithAdminAuth
);

module.exports = router;
