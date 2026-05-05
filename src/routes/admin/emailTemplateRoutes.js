const express = require("express");
const router = express.Router();
const emailTemplateController = require("../../controllers/admin/emailTemplateController");

// RESTful routes for email templates with proper controller method names
router.get("/modules", emailTemplateController.getModules); // Fetch all modules
router.get("/module/templates", emailTemplateController.getTemplatesByModule); // Fetch templates by module
router.put("/module/template/update", emailTemplateController.update);
module.exports = router;
