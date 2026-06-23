const db = require('../config/db');
const Razorpay = require('razorpay');
const crypto = require('crypto');

// Check if credentials are placeholders
const isMockMode = !process.env.RAZORPAY_KEY_ID || 
                   process.env.RAZORPAY_KEY_ID.includes('here') || 
                   process.env.RAZORPAY_KEY_ID === 'dummy_id';

let razorpay = null;
if (!isMockMode) {
  razorpay = new Razorpay({
    key_id: process.env.RAZORPAY_KEY_ID,
    key_secret: process.env.RAZORPAY_KEY_SECRET,
  });
}

exports.createOrder = async (req, res, next) => {
  const { shipping_address, promo_code } = req.body;

  if (!shipping_address) {
    return res.status(400).json({ error: { message: 'Shipping address is required.' } });
  }

  try {
    // 1. Fetch user's cart items
    const [carts] = await db.query('SELECT id FROM carts WHERE user_id = ?', [req.user.id]);
    if (carts.length === 0) {
      return res.status(400).json({ error: { message: 'Shopping cart is empty.' } });
    }
    const cartId = carts[0].id;

    const [items] = await db.query(
      `SELECT ci.quantity, p.id AS product_id, p.name, p.regular_price, p.discount_price, p.stock_quantity 
       FROM cart_items ci
       JOIN products p ON ci.product_id = p.id
       WHERE ci.cart_id = ?`,
      [cartId]
    );

    if (items.length === 0) {
      return res.status(400).json({ error: { message: 'Shopping cart is empty.' } });
    }

    // 2. Validate stock levels
    for (const item of items) {
      if (item.stock_quantity < item.quantity) {
        return res.status(400).json({ 
          error: { message: `Insufficient stock for product: ${item.name}. Available: ${item.stock_quantity}` } 
        });
      }
    }

    // 3. Calculate subtotal
    let subtotal = 0;
    items.forEach(item => {
      const price = item.discount_price !== null ? parseFloat(item.discount_price) : parseFloat(item.regular_price);
      subtotal += price * item.quantity;
    });

    // 4. Handle Promocode Discount
    let discount = 0;
    let promoId = null;
    if (promo_code) {
      const [promos] = await db.query('SELECT * FROM promo_codes WHERE code = ?', [promo_code]);
      if (promos.length > 0) {
        const promo = promos[0];
        const expiry = new Date(promo.expiry_date);
        if (expiry > new Date()) {
          promoId = promo.id;
          if (promo.discount_type === 'percentage') {
            discount = subtotal * (parseFloat(promo.discount_value) / 100);
          } else {
            discount = parseFloat(promo.discount_value);
          }
        }
      }
    }

    const totalAmount = Math.max(subtotal - discount, 0);

    // 5. Contact Razorpay API (or mock it)
    let razorpayOrderId = '';
    if (isMockMode) {
      razorpayOrderId = `order_mock_${crypto.randomBytes(8).toString('hex')}`;
    } else {
      const options = {
        amount: Math.round(totalAmount * 100), // paise
        currency: 'INR',
        receipt: `receipt_order_${Date.now()}`
      };
      const rpOrder = await razorpay.orders.create(options);
      razorpayOrderId = rpOrder.id;
    }

    // 6. Insert Order into local DB
    const [orderResult] = await db.query(
      `INSERT INTO orders (user_id, promo_code_id, total_amount, shipping_address, razorpay_order_id, status) 
       VALUES (?, ?, ?, ?, ?, 'pending')`,
      [req.user.id, promoId, totalAmount, shipping_address, razorpayOrderId]
    );
    const orderId = orderResult.insertId;

    // 7. Save Order Items
    for (const item of items) {
      const price = item.discount_price !== null ? parseFloat(item.discount_price) : parseFloat(item.regular_price);
      await db.query(
        'INSERT INTO order_items (order_id, product_id, quantity, price_at_purchase) VALUES (?, ?, ?, ?)',
        [orderId, item.product_id, item.quantity, price]
      );
    }

    res.status(201).json({
      message: 'Order created successfully.',
      order_id: orderId,
      razorpay_order_id: razorpayOrderId,
      amount: totalAmount,
      currency: 'INR'
    });

  } catch (error) {
    next(error);
  }
};

exports.verifyPayment = async (req, res, next) => {
  const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body;

  if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
    return res.status(400).json({ 
      error: { message: 'Missing payment signature verification parameters.' } 
    });
  }

  try {
    // 1. Verify payment signature
    let signatureVerified = false;

    if (isMockMode) {
      // Mock validation success
      signatureVerified = razorpay_signature.startsWith('mock_sig_');
    } else {
      const secret = process.env.RAZORPAY_KEY_SECRET;
      const hmac = crypto.createHmac('sha256', secret);
      hmac.update(razorpay_order_id + '|' + razorpay_payment_id);
      const generatedSignature = hmac.digest('hex');
      signatureVerified = generatedSignature === razorpay_signature;
    }

    if (!signatureVerified) {
      return res.status(400).json({ error: { message: 'Payment verification failed. Invalid signature.' } });
    }

    // 2. Fetch local order details
    const [orders] = await db.query('SELECT * FROM orders WHERE razorpay_order_id = ?', [razorpay_order_id]);
    if (orders.length === 0) {
      return res.status(404).json({ error: { message: 'Associated local order not found.' } });
    }

    const order = orders[0];

    // Prevent double verification of successfully captured payments
    if (order.status !== 'pending') {
      return res.status(400).json({ error: { message: 'Order has already been processed.' } });
    }

    // Begin updates (Transactions are recommended, but query-by-query works cleanly here)
    // 3. Deduct product stocks
    const [items] = await db.query('SELECT product_id, quantity FROM order_items WHERE order_id = ?', [order.id]);
    for (const item of items) {
      await db.query(
        'UPDATE products SET stock_quantity = stock_quantity - ? WHERE id = ?',
        [item.quantity, item.product_id]
      );
    }

    // 4. Update order status
    await db.query("UPDATE orders SET status = 'processing' WHERE id = ?", [order.id]);

    // 5. Record payment details
    await db.query(
      `INSERT INTO payments (order_id, razorpay_order_id, razorpay_payment_id, razorpay_signature, payment_method, status, amount) 
       VALUES (?, ?, ?, ?, ?, 'captured', ?)`,
      [order.id, razorpay_order_id, razorpay_payment_id, razorpay_signature, req.body.payment_method || 'UPI', order.total_amount]
    );

    // 6. Clear user cart items
    const [carts] = await db.query('SELECT id FROM carts WHERE user_id = ?', [req.user.id]);
    if (carts.length > 0) {
      await db.query('DELETE FROM cart_items WHERE cart_id = ?', [carts[0].id]);
    }

    // 7. Write Audit Log
    const ip = req.ip || req.connection.remoteAddress || '127.0.0.1';
    await db.query(
      'INSERT INTO activity_logs (user_id, action, ip_address) VALUES (?, ?, ?)',
      [req.user.id, `Order Checkout Successful - Order ID: ${order.id}`, ip]
    );

    res.status(200).json({
      message: 'Payment verified and order captured successfully.',
      order_id: order.id
    });

  } catch (error) {
    next(error);
  }
};

exports.getOrderHistory = async (req, res, next) => {
  try {
    const [orders] = await db.query(
      'SELECT id, total_amount, status, created_at FROM orders WHERE user_id = ? ORDER BY created_at DESC',
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
      fullHistory.push({
        ...order,
        items
      });
    }

    res.status(200).json({ orders: fullHistory });
  } catch (error) {
    next(error);
  }
};
