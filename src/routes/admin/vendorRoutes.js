const express = require("express");
const router = express.Router();
const vendorController = require("../../controllers/admin/vendorController");

router.post("/create", vendorController.create);
router.get("/list", vendorController.list);
router.put("/update", vendorController.update);
router.delete("/delete", vendorController.delete);
router.post("/login", vendorController.login);
router.post("/verify-login", vendorController.verifyLogin);

module.exports = router;
