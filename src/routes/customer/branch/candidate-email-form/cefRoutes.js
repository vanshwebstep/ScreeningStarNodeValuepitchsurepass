const express = require("express");
const router = express.Router();
const cefController = require("../../../../controllers/customer/branch/candidate/cefController");

// Basic routes
router.get("/test", cefController.test);
router.get("/service-form-json", cefController.formJson);
router.get("/unsubmitted-applications", cefController.unsubmittedApplications);
router.get("/is-application-exist", cefController.isApplicationExist);
router.put("/submit", cefController.submit);
router.post("/upload", cefController.upload);

module.exports = router;
