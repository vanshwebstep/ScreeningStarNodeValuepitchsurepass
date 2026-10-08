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
router.post("/fetch_insuff", apiBgvController.fetch_insufficiency);
router.post("/fetch-insuff", apiBgvController.fetch_insufficiency);
router.post("/fetch_insufficiency", apiBgvController.fetch_insufficiency);
router.post("/fetch-insufficiency", apiBgvController.fetch_insufficiency);
router.get("/fetch_insuff", apiBgvController.fetch_insufficiency);
router.get("/fetch_insufficiency", apiBgvController.fetch_insufficiency);

module.exports = router;
