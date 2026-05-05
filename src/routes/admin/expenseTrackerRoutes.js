const express = require("express");
const router = express.Router();
const expenseTrackerController = require("../../controllers/admin/expenseTrackerController");

// Authentication routes
router.post("/create", expenseTrackerController.create);
router.get("/expense-by-id", expenseTrackerController.getUpdateById )
router.put("/update", expenseTrackerController.update);
router.get("/", expenseTrackerController.list);
router.delete("/delete", expenseTrackerController.delete);

module.exports = router;
