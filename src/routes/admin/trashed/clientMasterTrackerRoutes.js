const express = require("express");
const router = express.Router();
const clientMasterTrackerController = require("../../../controllers/admin/trashed/clientApplicationController");

// Authentication routes
router.get("/list", clientMasterTrackerController.list);
router.get(
  "/branch-list-by-customer",
  clientMasterTrackerController.listByCustomerId
);
router.get(
  "/applications-by-branch",
  clientMasterTrackerController.applicationListByBranch
);
router.get("/filter-options", clientMasterTrackerController.filterOptions);
router.get(
  "/branch-filter-options",
  clientMasterTrackerController.filterOptionsForBranch
);
router.get("/customers-filter-option", clientMasterTrackerController.customerFilterOption);

router.delete("/application-delete", clientMasterTrackerController.applicationDelete);
router.put("/application-restore", clientMasterTrackerController.applicationRestore);

module.exports = router;
