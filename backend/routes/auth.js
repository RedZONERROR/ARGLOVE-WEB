const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const authMiddleware = require('../middleware/auth');
const { authLimiter } = require('../middleware/rateLimit');

router.post('/register', authLimiter, authController.register);
router.post('/login', authLimiter, authController.login);
router.get('/profile', authMiddleware, authController.getProfile);
router.post('/forgot-password', authLimiter, authController.forgotPassword);
router.post('/reset-password', authLimiter, authController.resetPassword);

module.exports = router;
