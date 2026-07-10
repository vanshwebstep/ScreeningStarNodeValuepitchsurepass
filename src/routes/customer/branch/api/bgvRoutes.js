const express = require("express");
const cors = require("cors");
const router = express.Router();
const multer = require("multer");

const apiBgvController = require("../../../../controllers/customer/branch/api/candidate/bgvController");

const app = express();
app.use(cors());

// Basic routes
router.put("/create", apiBgvController.submit);
router.post("/upload", apiBgvController.upload);
router.post("/fetch_report_status", apiBgvController.fetch_report_status);

module.exports = router;
