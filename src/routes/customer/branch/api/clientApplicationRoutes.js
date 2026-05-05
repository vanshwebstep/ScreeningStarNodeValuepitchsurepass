const express = require("express");
const cors = require("cors");
const router = express.Router();
const apiClientController = require("../../../../controllers/customer/branch/api/client/applicationController");

const app = express();
app.use(cors());

// Basic routes
router.post("/create", apiClientController.create);
router.post("/upload", apiClientController.upload);

module.exports = router;
