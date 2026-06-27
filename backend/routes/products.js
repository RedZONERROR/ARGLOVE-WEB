const express = require('express');
const router = express.Router();
const productController = require('../controllers/productController');
const productReviewController = require('../controllers/productReviewController');
const optionalAuth = require('../middleware/optionalAuth');
const authenticate = require('../middleware/auth');
const { uploadMedia, validateUploadedMedia } = require('../middleware/uploadMedia');

router.get('/', productController.getProducts);
router.get('/categories', productController.getCategories);
router.get('/:id/review-eligibility', optionalAuth, productReviewController.getReviewEligibility);
router.get('/:id/reviews', productReviewController.getProductReviews);
router.post(
  '/:id/reviews',
  authenticate,
  uploadMedia.array('photos', 5),
  validateUploadedMedia,
  productReviewController.submitProductReview
);
router.get('/:id', productController.getProductById);

module.exports = router;
