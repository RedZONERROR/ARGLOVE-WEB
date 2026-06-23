const express = require('express');
const router = express.Router();
const orderController = require('../controllers/orderController');
const authMiddleware = require('../middleware/auth');

// All order and checkout routes require authentication
router.use(authMiddleware);

router.post('/create', orderController.createOrder);
router.post('/verify', orderController.verifyPayment);
router.get('/history', orderController.getOrderHistory);

module.exports = router;
