const express = require("express");
const cors = require("cors");
const router = express.Router();
const apiClientController = require("../../../../controllers/customer/branch/api/client/applicationController");

const app = express();
app.use(cors());

// Basic routes
router.post("/create", apiClientController.create);
router.post("/upload", apiClientController.upload);
router.post("/fetch_insuff", apiClientController.fetch_insufficiency);
router.post("/fetch-insuff", apiClientController.fetch_insufficiency);
router.post("/fetch_insufficiency", apiClientController.fetch_insufficiency);
router.post("/fetch-insufficiency", apiClientController.fetch_insufficiency);
router.get("/fetch_insuff", apiClientController.fetch_insufficiency);
router.get("/fetch_insufficiency", apiClientController.fetch_insufficiency);

module.exports = router;
