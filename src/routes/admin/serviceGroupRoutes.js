const express = require('express');
const router = express.Router();
const serviceGroupController = require('../../controllers/admin/serviceGroupController');

// Authentication routes
router.post('/create', serviceGroupController.create);
router.get('/list', serviceGroupController.list);
router.get('/service-group-info', serviceGroupController.getServiceGroupById);
router.put('/update', serviceGroupController.update);
router.delete('/delete', serviceGroupController.delete);

module.exports = router;
