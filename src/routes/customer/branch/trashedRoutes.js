const express = require("express");
const cors = require("cors");
const router = express.Router();
const clientApplicationRoutes = require("./trashed/clientApplication");

const app = express();
app.use(cors());

router.use("/client-application", clientApplicationRoutes);

module.exports = router;
