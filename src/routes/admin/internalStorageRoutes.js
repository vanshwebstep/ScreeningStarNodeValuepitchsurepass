const express = require("express");
const router = express.Router();

const university = require("./internal-storage/universityRoutes");
const exEmployment = require("./internal-storage/exEmploymentRoutes");
const vendor = require("./internal-storage/vendorRoutes");
const dailyActivityTracker = require("./internal-storage/dailtyActivityTrackerRoutes");

// Authentication routes
router.use("/university", university);
router.use("/ex-employment", exEmployment);
router.use("/vendor", vendor);
router.use("/daily-activity-tracker", dailyActivityTracker);
module.exports = router;
