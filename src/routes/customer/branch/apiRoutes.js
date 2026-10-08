const express = require("express");
const cors = require("cors");
const router = express.Router();
const candidateApplicationRoutes = require("./api/candidateApplicationRoutes.js");
const BgvRoutes = require("./api/bgvRoutes.js");
const clientApplicationRoutes = require("./api/clientApplicationRoutes.js");
const apiServiceController = require("../../../controllers/customer/branch/api/serviceController");

const apiClientController = require("../../../controllers/customer/branch/api/client/applicationController");

const app = express();
app.use(cors());

// Basic routes
router.use("/candidate-application", candidateApplicationRoutes);
router.use("/client-application", clientApplicationRoutes);
router.post("/services", apiServiceController.list);
router.use("/bgv-application", BgvRoutes);
router.post("/fetch_insuff", apiClientController.fetch_insufficiency);
router.post("/fetch-insuff", apiClientController.fetch_insufficiency);
router.post("/fetch_insufficiency", apiClientController.fetch_insufficiency);
router.post("/fetch-insufficiency", apiClientController.fetch_insufficiency);
router.get("/fetch_insuff", apiClientController.fetch_insufficiency);
router.get("/fetch_insufficiency", apiClientController.fetch_insufficiency);

module.exports = router;
