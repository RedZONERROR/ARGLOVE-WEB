const db = require('../config/db');
const crypto = require('crypto');
const { isMockMode, getRazorpay } = require('../utils/razorpayClient');
const { fulfillPaidOrder } = require('../utils/orderFulfillment');
const { variantPrice } = require('../utils/productVariants');
const { plainTextFromHtml, mapPlainItemNames } = require('../utils/plainText');

async function resolvePromo(promo_code, subtotal) {
  if (!promo_code) {
    return { discount: 0, promoId: null };
  }

  const [promos] = await db.query('SELECT * FROM promo_codes WHERE code = ?', [promo_code]);
  if (promos.length === 0) {
    return { error: 'Invalid promo code.' };
  }

  const promo = promos[0];
  const expiry = new Date(promo.expiry_date);
  if (expiry <= new Date()) {
    return { error: 'Promo code has expired.' };
  }

  let discount = 0;
  if (promo.discount_type === 'percentage') {
    discount = subtotal * (parseFloat(promo.discount_value) / 100);
  } else {
    discount = parseFloat(promo.discount_value);
  }

  return { discount, promoId: promo.id };
}

exports.createOrder = async (req, res, next) => {
  const { shipping_address, promo_code } = req.body;

  if (!shipping_address) {
    return res.status(400).json({ error: { message: 'Shipping address is required.' } });
  }

  try {
    const [carts] = await db.query('SELECT id FROM carts WHERE user_id = ?', [req.user.id]);
    if (carts.length === 0) {
      return res.status(400).json({ error: { message: 'Shopping cart is empty.' } });
    }
    const cartId = carts[0].id;

    const [items] = await db.query(
      `SELECT ci.quantity, ci.variant_id,
              p.id AS product_id, p.name, p.regular_price, p.discount_price, p.stock_quantity,
              pv.label AS variant_label, pv.regular_price AS variant_regular_price,
              pv.discount_price AS variant_discount_price, pv.stock_quantity AS variant_stock_quantity
       FROM cart_items ci
       JOIN products p ON ci.product_id = p.id
       LEFT JOIN product_variants pv ON ci.variant_id = pv.id
       WHERE ci.cart_id = ?`,
      [cartId]
    );

    if (items.length === 0) {
      return res.status(400).json({ error: { message: 'Shopping cart is empty.' } });
    }

    for (const item of items) {
      const stock = item.variant_id ? item.variant_stock_quantity : item.stock_quantity;
      const label = plainTextFromHtml(
        item.variant_label ? `${item.name} (${item.variant_label})` : item.name
      );
      if (stock < item.quantity) {
        return res.status(400).json({
          error: {
            message: `Insufficient stock for product: ${label}. Available: ${stock}`,
          },
        });
      }
    }

    let subtotal = 0;
    items.forEach((item) => {
      const price = item.variant_id
        ? variantPrice({
            discount_price: item.variant_discount_price,
            regular_price: item.variant_regular_price,
          })
        : item.discount_price !== null
          ? parseFloat(item.discount_price)
          : parseFloat(item.regular_price);
      subtotal += price * item.quantity;
    });

    const promoResult = await resolvePromo(promo_code, subtotal);
    if (promoResult.error) {
      return res.status(400).json({ error: { message: promoResult.error } });
    }

    const { discount, promoId } = promoResult;
    const totalAmount = Math.max(subtotal - discount, 0);

    let razorpayOrderId = '';
    if (isMockMode()) {
      razorpayOrderId = `order_mock_${crypto.randomBytes(8).toString('hex')}`;
    } else {
      const options = {
        amount: Math.round(totalAmount * 100),
        currency: 'INR',
        receipt: `receipt_order_${Date.now()}`,
      };
      const rpOrder = await getRazorpay().orders.create(options);
      razorpayOrderId = rpOrder.id;
    }

    const [orderResult] = await db.query(
      `INSERT INTO orders (user_id, promo_code_id, total_amount, shipping_address, razorpay_order_id, status) 
       VALUES (?, ?, ?, ?, ?, 'pending')`,
      [req.user.id, promoId, totalAmount, shipping_address, razorpayOrderId]
    );
    const orderId = orderResult.insertId;

    for (const item of items) {
      const price = item.variant_id
        ? variantPrice({
            discount_price: item.variant_discount_price,
            regular_price: item.variant_regular_price,
          })
        : item.discount_price !== null
          ? parseFloat(item.discount_price)
          : parseFloat(item.regular_price);
      await db.query(
        'INSERT INTO order_items (order_id, product_id, variant_id, variant_label, quantity, price_at_purchase) VALUES (?, ?, ?, ?, ?, ?)',
        [orderId, item.product_id, item.variant_id || null, item.variant_label || null, item.quantity, price]
      );
    }

    res.status(201).json({
      message: 'Order created successfully.',
      order_id: orderId,
      razorpay_order_id: razorpayOrderId,
      razorpay_key_id: process.env.RAZORPAY_KEY_ID || null,
      amount: totalAmount,
      currency: 'INR',
    });
  } catch (error) {
    next(error);
  }
};

exports.verifyPayment = async (req, res, next) => {
  const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body;

  if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
    return res.status(400).json({
      error: { message: 'Missing payment signature verification parameters.' },
    });
  }

  try {
    let signatureVerified = false;

    if (isMockMode()) {
      signatureVerified = razorpay_signature.startsWith('mock_sig_');
    } else {
      const secret = process.env.RAZORPAY_KEY_SECRET;
      const hmac = crypto.createHmac('sha256', secret);
      hmac.update(razorpay_order_id + '|' + razorpay_payment_id);
      signatureVerified = hmac.digest('hex') === razorpay_signature;
    }

    if (!signatureVerified) {
      return res.status(400).json({ error: { message: 'Payment verification failed. Invalid signature.' } });
    }

    const [orders] = await db.query('SELECT * FROM orders WHERE razorpay_order_id = ?', [razorpay_order_id]);
    if (orders.length === 0) {
      return res.status(404).json({ error: { message: 'Associated local order not found.' } });
    }

    const order = orders[0];

    if (order.user_id !== req.user.id) {
      return res.status(403).json({ error: { message: 'You are not authorized to verify this order.' } });
    }

    const result = await fulfillPaidOrder(order.id, {
      razorpay_order_id,
      razorpay_payment_id,
      razorpay_signature,
      payment_method: req.body.payment_method || 'UPI',
      status: 'captured',
    });

    if (!result.fulfilled) {
      if (result.reason === 'already_processed') {
        return res.status(400).json({ error: { message: 'Order has already been processed.' } });
      }
      if (result.reason === 'insufficient_stock') {
        return res.status(409).json({ error: { message: 'Insufficient stock to fulfill this order.' } });
      }
      return res.status(404).json({ error: { message: 'Associated local order not found.' } });
    }

    const ip = req.ip || req.connection.remoteAddress || '127.0.0.1';
    await db.query(
      'INSERT INTO activity_logs (user_id, action, ip_address) VALUES (?, ?, ?)',
      [req.user.id, `Order Checkout Successful - Order ID: ${order.id}`, ip]
    );

    res.status(200).json({
      message: 'Payment verified and order captured successfully.',
      order_id: order.id,
    });
  } catch (error) {
    next(error);
  }
};

exports.getOrderHistory = async (req, res, next) => {
  try {
    const [orders] = await db.query(
      `SELECT o.id, o.total_amount, o.status, o.created_at, o.shipping_address, o.razorpay_order_id,
              pc.code AS promo_code
       FROM orders o
       LEFT JOIN promo_codes pc ON o.promo_code_id = pc.id
       WHERE o.user_id = ?
       ORDER BY o.created_at DESC`,
      [req.user.id]
    );

    const fullHistory = [];
    for (const order of orders) {
      const [items] = await db.query(
        `SELECT oi.quantity, oi.price_at_purchase, p.name 
         FROM order_items oi
         JOIN products p ON oi.product_id = p.id
         WHERE oi.order_id = ?`,
        [order.id]
      );
      const [payments] = await db.query(
        `SELECT razorpay_payment_id, razorpay_order_id, status AS payment_status, razorpay_refund_id
         FROM payments WHERE order_id = ? ORDER BY id DESC LIMIT 1`,
        [order.id]
      );
      const pay = payments[0] || {};
      fullHistory.push({
        ...order,
        items: mapPlainItemNames(items),
        razorpay_payment_id: pay.razorpay_payment_id || null,
        razorpay_order_id: pay.razorpay_order_id || order.razorpay_order_id || null,
        payment_status: pay.payment_status || null,
        razorpay_refund_id: pay.razorpay_refund_id || null,
      });
    }

    res.status(200).json({ orders: fullHistory });
  } catch (error) {
    next(error);
  }
};
