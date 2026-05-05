const express = require("express");
const cors = require("cors");
const router = express.Router();
const candidateApplicationRoutes = require("./api/candidateApplicationRoutes.js");
const BgvRoutes = require("./api/bgvRoutes.js");
const clientApplicationRoutes = require("./api/clientApplicationRoutes.js");
const apiServiceController = require("../../../controllers/customer/branch/api/serviceController");

const app = express();
app.use(cors());

// Basic routes
router.use("/candidate-application", candidateApplicationRoutes);
router.use("/client-application", clientApplicationRoutes);
router.get("/services", apiServiceController.list);
router.use("/bgv-application", BgvRoutes);


module.exports = router;
