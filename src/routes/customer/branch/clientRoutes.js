const express = require("express");
const router = express.Router();
const clientController = require("../../../controllers/customer/branch/client/applicationController");

// Basic routes
router.post("/create", clientController.create);
router.post("/bulk-create", clientController.bulkCreate);
router.get("/listings", clientController.createClientAppListings);
router.post("/upload", clientController.upload);
router.get("/list", clientController.list);
router.put("/update", clientController.update);
router.delete("/delete", clientController.delete);
router.post("/fetch_insuff", clientController.fetch_insufficiency);
router.post("/fetch-insuff", clientController.fetch_insufficiency);
router.post("/fetch_insufficiency", clientController.fetch_insufficiency);
router.post("/fetch-insufficiency", clientController.fetch_insufficiency);
router.get("/fetch_insuff", clientController.fetch_insufficiency);
router.get("/fetch_insufficiency", clientController.fetch_insufficiency);

module.exports = router;
