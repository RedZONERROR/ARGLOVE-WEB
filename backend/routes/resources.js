const express = require('express');
const router = express.Router();
const resourceController = require('../controllers/resourceController');
const authMiddleware = require('../middleware/auth');
const uploadMiddleware = require('../middleware/upload');
const { uploadMedia, validateUploadedMedia } = require('../middleware/uploadMedia');

router.use(authMiddleware);

router.post(
  '/upload',
  uploadMiddleware.single('file'),
  uploadMiddleware.validateUploadedImage,
  resourceController.uploadResource
);
router.post(
  '/upload-media',
  uploadMedia.single('file'),
  validateUploadedMedia,
  resourceController.uploadResource
);
router.delete('/:id', resourceController.deleteResource);

module.exports = router;
