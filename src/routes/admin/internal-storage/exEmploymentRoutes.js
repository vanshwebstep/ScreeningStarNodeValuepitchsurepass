const express = require("express");
const router = express.Router();
const exEmploymentController = require("../../../controllers/admin/internal-storage/exEmploymentController");

// Authentication routes
router.post("/create", exEmploymentController.create);
router.post("/bulk/create", exEmploymentController.bulkCreate);
router.get("/list", exEmploymentController.list);
router.put("/update", exEmploymentController.update);
router.delete("/delete", exEmploymentController.delete);

module.exports = router;
