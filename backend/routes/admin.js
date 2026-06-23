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
router.get('/dashboard', dashboardController.getDashboardStats);

module.exports = router;
