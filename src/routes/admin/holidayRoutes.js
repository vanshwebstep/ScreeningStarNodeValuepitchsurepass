const express = require('express');
const router = express.Router();
const holidayController = require('../../controllers/admin/holidayController');

// Authentication routes
router.post('/create', holidayController.create);
router.get('/list', holidayController.list);
router.get('/holiday-info', holidayController.getHolidayById);
router.put('/update', holidayController.update);
router.delete('/delete', holidayController.delete);

module.exports = router;
