const express = require("express");
const router = express.Router();
const ticketController = require("../../../controllers/customer/branch/ticketController");

// Basic routes
router.get("/list", ticketController.list);
router.get("/view", ticketController.view);
router.post("/chat", ticketController.chat);
router.post("/create", ticketController.create);
router.post("/upload", ticketController.upload);
router.delete("/delete", ticketController.delete);

module.exports = router;
