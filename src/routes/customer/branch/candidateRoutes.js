const express = require("express");
const cors = require("cors");
const router = express.Router();
const candidateController = require("../../../controllers/customer/branch/candidate/applicationController");
const cefRoutes = require("./candidate-email-form/cefRoutes.js");
const davRoutes = require("./digital-address-verification/davRoutes.js");

const app = express();
app.use(cors());

// Basic routes
router.post("/create", candidateController.create);
router.post("/bulk-create", candidateController.bulkCreate);
router.get("/list", candidateController.list);
router.get("/listings", candidateController.createCandidateAppListings);
router.put("/update", candidateController.update);
router.delete("/delete", candidateController.delete);
router.delete("/", candidateController.delete);

router.use("/backgroud-verification", cefRoutes);
router.use("/digital-address-verification", davRoutes);

module.exports = router;
