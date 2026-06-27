const express = require('express');
const router = express.Router();
const orderController = require('../controllers/orderController');
const authMiddleware = require('../middleware/auth');
const { paymentLimiter } = require('../middleware/rateLimit');

router.use(authMiddleware);

router.post('/create', paymentLimiter, orderController.createOrder);
router.post('/verify', paymentLimiter, orderController.verifyPayment);
router.get('/history', orderController.getOrderHistory);

module.exports = router;
