const express = require("express");
const router = express.Router();
const documentCheckInController = require("../../controllers/admin/documentCheckInController");

// Authentication routes
router.get("/list", documentCheckInController.list);
router.get(
  "/applications-by-branch",
  documentCheckInController.applicationListByBranch
);

router.post("/upload", documentCheckInController.upload);

module.exports = router;
