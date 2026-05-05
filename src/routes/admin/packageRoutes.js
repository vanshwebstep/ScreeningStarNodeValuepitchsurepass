const express = require('express');
const router = express.Router();
const packageController = require('../../controllers/admin/packageController');

// Authentication routes
router.post('/create', packageController.create);
router.get('/list', packageController.list);
router.get('/package-info', packageController.getPackageById);
router.put('/update', packageController.update);
router.delete('/delete', packageController.delete);

module.exports = router;
