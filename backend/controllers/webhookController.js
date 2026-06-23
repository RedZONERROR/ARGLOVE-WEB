const db = require('../config/db');
const crypto = require('crypto');

exports.handleRazorpayWebhook = async (req, res, next) => {
  const signature = req.headers['x-razorpay-signature'];

  if (!signature) {
    return res.status(400).json({ error: { message: 'Missing webhook signature header.' } });
  }

  try {
    const webhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET || 'your_razorpay_webhook_secret_here';

    // Verify signature
    const hmac = crypto.createHmac('sha256', webhookSecret);
    hmac.update(req.rawBody || '');
    const calculatedSignature = hmac.digest('hex');

    // Support mock verification for testing if signature matches mock pattern
    const isMock = signature.startsWith('mock_sig_') && 
                   (webhookSecret.startsWith('mock_') || webhookSecret === 'your_razorpay_webhook_secret_here');

    if (calculatedSignature !== signature && !isMock) {
      return res.status(400).json({ error: { message: 'Invalid webhook signature.' } });
    }

    const { event, payload } = req.body;
    console.log(`Razorpay Webhook Event Received: ${event}`);

    // We specifically handle 'order.paid' and 'payment.captured'
    if (event === 'order.paid' || event === 'payment.captured') {
      let razorpayOrderId = null;

      if (payload.order && payload.order.entity) {
        razorpayOrderId = payload.order.entity.id;
      } else if (payload.payment && payload.payment.entity) {
        razorpayOrderId = payload.payment.entity.order_id;
      }

      if (!razorpayOrderId) {
        console.warn('Webhook payload missing razorpay_order_id.');
        return res.status(200).json({ status: 'ignored', message: 'Missing razorpay_order_id.' });
      }

      // 1. Fetch matching local order
      const [orders] = await db.query('SELECT * FROM orders WHERE razorpay_order_id = ?', [razorpayOrderId]);
      if (orders.length === 0) {
        console.warn(`Local order not found for Razorpay Order ID: ${razorpayOrderId}`);
        return res.status(200).json({ status: 'ignored', message: 'Local order not found.' });
      }

      const order = orders[0];

      // 2. Prevent double verification of captured payments
      if (order.status !== 'pending') {
        console.log(`Order ID: ${order.id} is already processed (Status: ${order.status}). Webhook ignored.`);
        return res.status(200).json({ status: 'ignored', message: 'Order already processed.' });
      }

      // 3. Extract transaction details from webhook payload
      const paymentEntity = payload.payment ? payload.payment.entity : null;
      const paymentId = paymentEntity ? paymentEntity.id : `pay_webhook_${crypto.randomBytes(6).toString('hex')}`;
      const paymentMethod = paymentEntity ? paymentEntity.method : 'Webhook';
      const paymentStatus = paymentEntity ? paymentEntity.status : 'captured';

      // 4. Update product stocks
      const [items] = await db.query('SELECT product_id, quantity FROM order_items WHERE order_id = ?', [order.id]);
      for (const item of items) {
        await db.query(
          'UPDATE products SET stock_quantity = stock_quantity - ? WHERE id = ?',
          [item.quantity, item.product_id]
        );
      }

      // 5. Update order status to processing
      await db.query("UPDATE orders SET status = 'processing' WHERE id = ?", [order.id]);

      // 6. Record payment details
      await db.query(
        `INSERT INTO payments (order_id, razorpay_order_id, razorpay_payment_id, razorpay_signature, payment_method, status, amount) 
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [order.id, razorpayOrderId, paymentId, signature, paymentMethod, paymentStatus, order.total_amount]
      );

      // 7. Clear user cart
      const [carts] = await db.query('SELECT id FROM carts WHERE user_id = ?', [order.user_id]);
      if (carts.length > 0) {
        await db.query('DELETE FROM cart_items WHERE cart_id = ?', [carts[0].id]);
      }

      // 8. Write Audit Log
      await db.query(
        'INSERT INTO activity_logs (user_id, action, ip_address) VALUES (?, ?, ?)',
        [order.user_id, `Order Checkout Captured via Webhook - Order ID: ${order.id}`, 'webhook-server']
      );

      console.log(`Successfully processed payment capture webhook for Order ID: ${order.id}`);
      return res.status(200).json({ status: 'success', message: 'Order captured via webhook.' });
    }

    // Default response for other webhook events
    res.status(200).json({ status: 'ignored', message: 'Event not handled.' });

  } catch (error) {
    next(error);
  }
};
