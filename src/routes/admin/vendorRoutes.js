const express = require("express");
const router = express.Router();
const vendorController = require("../../controllers/admin/vendorController");
const { upload } = require("../../utils/cloudImageSave");

router.post("/create", vendorController.create);
router.get("/list", vendorController.list);
router.get("/detail", vendorController.detail);
router.put("/update", vendorController.update);
router.post("/status", vendorController.updateStatus);
router.delete("/delete", vendorController.delete);
router.post("/login", vendorController.login);
router.post("/verify-login", vendorController.verifyLogin);
router.put("/update-password", vendorController.updatePassword);
router.get("/cases", vendorController.caseList);
router.post("/cases/accept", vendorController.acceptCase);
router.post("/cases/upload-report", upload, vendorController.uploadCaseReport);
router.post("/cases/complete", vendorController.completeCase);
router.post("/cases/verified-date", vendorController.updateCaseVerifiedDate);
router.post("/forgot-password-request", vendorController.forgotPasswordRequest);
router.post("/forgot-password", vendorController.forgotPassword);

module.exports = router;
