const express = require("express");
const cors = require("cors");
const router = express.Router();
const apiCandidateController = require("../../../../controllers/customer/branch/api/candidate/applicationController");

const app = express();
app.use(cors());

// Basic routes
router.post("/create", apiCandidateController.create);
router.post("/fetch_bgv_pdf", apiCandidateController.fetch_bgv_pdf);

module.exports = router;
