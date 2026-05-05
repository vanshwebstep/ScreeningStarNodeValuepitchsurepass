const express = require("express");
const router = express.Router();
const ticketController = require("../../controllers/admin/ticketController");

// Basic routes
router.get("/list", ticketController.list);
router.get("/view", ticketController.view);
router.post("/chat", ticketController.chat);
router.post("/upload", ticketController.upload);
router.put("/update", ticketController.update);
router.delete("/delete", ticketController.delete);

module.exports = router;
