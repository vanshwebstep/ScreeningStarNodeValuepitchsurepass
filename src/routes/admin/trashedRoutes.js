const express = require("express");
const router = express.Router();

const clientMasterTrackerRoutes = require("../admin/trashed/clientMasterTrackerRoutes");
const customerRoutes = require("../admin/trashed/customerRoutes");

// Authentication routes
router.use("/client-master-tracker", clientMasterTrackerRoutes);
router.use("/customer", customerRoutes);
module.exports = router;
