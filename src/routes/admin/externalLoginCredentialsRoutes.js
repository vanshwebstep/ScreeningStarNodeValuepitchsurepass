const express = require('express');
const router = express.Router();
const externalLoginCredentialsController = require('../../controllers/admin/externalLoginCredentialController');

// Authentication Routes
router.get('/list', externalLoginCredentialsController.list);

module.exports = router;
