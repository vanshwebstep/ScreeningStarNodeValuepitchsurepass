const express = require("express");
const router = express.Router();
const dailyActivityTrackerController = require("../../../controllers/admin/internal-storage/dailyActivityTrackerController");

// Authentication routes
router.post("/create", dailyActivityTrackerController.create);
router.post("/bulk/create", dailyActivityTrackerController.bulkCreate);
router.get("/list", dailyActivityTrackerController.list);
router.put("/update", dailyActivityTrackerController.update);
router.delete("/delete", dailyActivityTrackerController.delete);

module.exports = router;
