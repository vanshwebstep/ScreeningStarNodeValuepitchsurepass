const express = require("express");
const router = express.Router();
const clientMasterTrackerController = require("../../controllers/admin/clientMasterTrackerController");

// Authentication routes
router.get("/list", clientMasterTrackerController.list);
router.get("/test", clientMasterTrackerController.test);
router.get(
  "/branch-list-by-customer",
  clientMasterTrackerController.listByCustomerId
);
router.get(
  "/applications-by-branch",
  clientMasterTrackerController.applicationListByBranch
);
router.get("/application-by-id", clientMasterTrackerController.applicationByID);
router.get("/filter-options", clientMasterTrackerController.filterOptions);
router.get(
  "/branch-filter-options",
  clientMasterTrackerController.filterOptionsForBranch
);
router.get("/annexure-data", clientMasterTrackerController.annexureData);
router.get("/customers-filter-option", clientMasterTrackerController.customerFilterOption);
router.post("/submit-valuepitch", clientMasterTrackerController.submitValuePitch);
router.post("/submit-surepass",   clientMasterTrackerController.submitSurepass);
router.post("/submit-manual",     clientMasterTrackerController.submitManual);
router.put("/generate-report", clientMasterTrackerController.generateReport);
router.get(
  "/report-form-json-by-service-id",
  clientMasterTrackerController.reportFormJsonByServiceID
);

router.get(
  "/customer-info",
  clientMasterTrackerController.customerBasicInfoWithAdminAuth
);

router.get(
  "/services-annexure-data",
  clientMasterTrackerController.annexureDataByServiceIds
);

router.get(
  "/application-service",
  clientMasterTrackerController.annexureDataByServiceIdofApplication
);
router.delete("/application-delete", clientMasterTrackerController.applicationDelete);
router.get("/application-highlight", clientMasterTrackerController.applicationHighlight);

router.post("/upload", clientMasterTrackerController.upload);
router.get("/fetch-value-pitch-status", clientMasterTrackerController.valuePitchStatus);
router.get("/fetch-value-pitch-report-data", clientMasterTrackerController.valuePitchReportData);
router.get("/fetch-surepass-data", clientMasterTrackerController.surePassData);

module.exports = router;
