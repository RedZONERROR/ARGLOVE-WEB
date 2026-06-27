const express = require('express');
const router = express.Router();
const adminController = require('../controllers/adminController');
const dashboardController = require('../controllers/dashboardController');
const cmsController = require('../controllers/cmsController');
const productReviewController = require('../controllers/productReviewController');
const authMiddleware = require('../middleware/auth');
const adminMiddleware = require('../middleware/admin');

// All admin routes require authentication & admin role validation
router.use(authMiddleware, adminMiddleware);

// Products
router.get('/products', adminController.getAdminProducts);
router.get('/products/:id', adminController.getAdminProductById);
router.post('/products', adminController.createProduct);
router.put('/products/:id', adminController.updateProduct);
router.delete('/products/:id', adminController.deleteProduct);

// Categories
router.post('/categories', adminController.createCategory);
router.put('/categories/:id', adminController.updateCategory);
router.delete('/categories/:id', adminController.deleteCategory);

// Dashboard
router.get('/dashboard', dashboardController.getDashboardStats);

// Orders
router.put('/orders/:id/status', adminController.updateOrderStatus);
router.post('/orders/:id/refund', adminController.refundOrder);
router.get('/orders', adminController.getOrders);
router.get('/orders/:id', adminController.getOrderById);

// Users
router.get('/users', adminController.getUsers);
router.put('/users/:id/status', adminController.toggleUserStatus);
router.put('/users/:id/role', adminController.updateUserRole);

// Promo codes
router.get('/promos', adminController.getPromoCodes);
router.post('/promos', adminController.createPromoCode);
router.put('/promos/:id', adminController.updatePromoCode);
router.delete('/promos/:id', adminController.deletePromoCode);

// CMS (admin write)
router.put('/cms/:key', cmsController.updateContent);

// Reviews moderation
router.get('/reviews', productReviewController.getAdminProductReviews);
router.put('/reviews/:id/status', productReviewController.moderateReview);

module.exports = router;
