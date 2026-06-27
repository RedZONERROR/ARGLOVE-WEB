const express = require('express');
const router = express.Router();
const cmsController = require('../controllers/cmsController');

// Public CMS read
// - GET /api/cms?keys=header,hero,footer
router.get('/', cmsController.getSections);

// - GET /api/cms/:key
router.get('/:key', cmsController.getSection);

module.exports = router;
