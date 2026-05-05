const express = require("express");
const router = express.Router();
const authorizedDetailsController = require("../../controllers/admin/authorizedDetailController");

// Authentication routes
router.post("/create", authorizedDetailsController.create);
router.get("/list", authorizedDetailsController.list);
router.get(
  "/authorized-detail-info",
  authorizedDetailsController.getAuthorizedDetailById
);
router.put("/update", authorizedDetailsController.update);
router.delete("/delete", authorizedDetailsController.delete);

module.exports = router;
