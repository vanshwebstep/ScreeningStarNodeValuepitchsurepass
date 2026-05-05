const express = require("express");
const router = express.Router();
const breakRoutes = require("./personal-manager/breakRoutes");
const personalManagerController = require("../../controllers/admin/personalManagerController");

// Authentication routes
router.post("/create", personalManagerController.create);
router.get("/list", personalManagerController.list);
router.get("/attendance-list", personalManagerController.attendanceIndex);
router.get("/my-list", personalManagerController.myList);
router.post("/upload", personalManagerController.upload);
router.put("/update", personalManagerController.update);
router.put("/response", personalManagerController.response);
router.delete("/delete", personalManagerController.delete);

router.use("/break", breakRoutes);
module.exports = router;
