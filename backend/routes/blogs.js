const express = require('express');
const router = express.Router();
const blogController = require('../controllers/blogController');
const authMiddleware = require('../middleware/auth');

router.get('/', blogController.getBlogs);
router.get('/:id', blogController.getBlogById);
router.post('/:id/comment', authMiddleware, blogController.addComment);

module.exports = router;
