const express = require("express");
const cors = require("cors");
const router = express.Router();
const apiCandidateController = require("../../../../controllers/customer/branch/api/candidate/applicationController");

const app = express();
app.use(cors());

// Basic routes
router.post("/create", apiCandidateController.create);
router.post("/fetch_bgv_pdf", apiCandidateController.fetch_bgv_pdf);
router.post("/fetch_insuff", apiCandidateController.fetch_insufficiency);
router.post("/fetch-insuff", apiCandidateController.fetch_insufficiency);
router.post("/fetch_insufficiency", apiCandidateController.fetch_insufficiency);
router.post("/fetch-insufficiency", apiCandidateController.fetch_insufficiency);
router.get("/fetch_insuff", apiCandidateController.fetch_insufficiency);
router.get("/fetch_insufficiency", apiCandidateController.fetch_insufficiency);

module.exports = router;
