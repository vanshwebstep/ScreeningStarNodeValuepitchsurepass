const express = require("express");
const router = express.Router();
const universityController = require("../../../controllers/admin/internal-storage/universityController");

// Authentication routes
router.post("/create", universityController.create);
router.post("/bulk/create", universityController.bulkCreate);
router.get("/list", universityController.list);
router.put("/update", universityController.update);
router.delete("/delete", universityController.delete);

module.exports = router;
