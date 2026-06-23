const db = require('../config/db');

exports.validatePromoCode = async (req, res, next) => {
  const { code } = req.body;

  if (!code) {
    return res.status(400).json({ error: { message: 'Promo code is required.' } });
  }

  try {
    const [promos] = await db.query('SELECT * FROM promo_codes WHERE code = ?', [code]);

    if (promos.length === 0) {
      return res.status(404).json({ error: { message: 'Invalid promo code.' } });
    }

    const promo = promos[0];

    const now = new Date();
    const expiry = new Date(promo.expiry_date);

    if (expiry < now) {
      return res.status(400).json({ error: { message: 'Promo code has expired.' } });
    }

    res.status(200).json({
      message: 'Promo code is active and valid.',
      promo: {
        id: promo.id,
        code: promo.code,
        discount_type: promo.discount_type,
        discount_value: parseFloat(promo.discount_value),
        expiry_date: promo.expiry_date
      }
    });
  } catch (error) {
    next(error);
  }
};
