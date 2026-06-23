const express = require('express');
const router = express.Router();
const resourceController = require('../controllers/resourceController');
const authMiddleware = require('../middleware/auth');
const uploadMiddleware = require('../middleware/upload');

// Require authentication for resource changes
router.use(authMiddleware);

// Handle file uploads using multer middleware single attachment logic
router.post('/upload', uploadMiddleware.single('file'), resourceController.uploadResource);
router.delete('/:id', resourceController.deleteResource);

module.exports = router;
