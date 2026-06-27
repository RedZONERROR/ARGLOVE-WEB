const express = require('express');
const router = express.Router();
const promoController = require('../controllers/promoController');
const { promoLimiter } = require('../middleware/rateLimit');

router.post('/validate', promoLimiter, promoController.validatePromoCode);

module.exports = router;
