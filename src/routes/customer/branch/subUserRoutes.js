const express = require("express");
const router = express.Router();
const subUserController = require("../../../controllers/customer/branch/sub_user/subUserController");

// Basic routes
router.post("/create", subUserController.create);
router.get("/list", subUserController.list);
router.put("/update-email", subUserController.updateEmail);
router.put("/update-password", subUserController.updatePassword);
router.delete("/delete", subUserController.delete);

module.exports = router;
