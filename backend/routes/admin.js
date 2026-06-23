const express = require('express');
const router = express.Router();
const adminController = require('../controllers/adminController');
const dashboardController = require('../controllers/dashboardController');
const authMiddleware = require('../middleware/auth');
const adminMiddleware = require('../middleware/admin');

// All admin routes require authentication & admin role validation
router.use(authMiddleware, adminMiddleware);

router.post('/products', adminController.createProduct);
router.put('/products/:id', adminController.updateProduct);
router.delete('/products/:id', adminController.deleteProduct);
router.post('/categories', adminController.createCategory);
router.put('/categories/:id', adminController.updateCategory);
router.delete('/categories/:id', adminController.deleteCategory);
router.get('/dashboard', dashboardController.getDashboardStats);
router.put('/orders/:id/status', adminController.updateOrderStatus);
router.get('/orders', adminController.getOrders);
router.get('/orders/:id', adminController.getOrderById);
router.get('/users', adminController.getUsers);
router.put('/users/:id/status', adminController.toggleUserStatus);

module.exports = router;
