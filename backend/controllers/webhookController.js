const db = require('../config/db');
const crypto = require('crypto');
const { fulfillPaidOrder } = require('../utils/orderFulfillment');

function isPlaceholderWebhookSecret(secret) {
  return !secret || secret.includes('your_') || secret.startsWith('mock_');
}

exports.handleRazorpayWebhook = async (req, res, next) => {
  const signature = req.headers['x-razorpay-signature'];

  if (!signature) {
    return res.status(400).json({ error: { message: 'Missing webhook signature header.' } });
  }

  try {
    const webhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET;

    if (process.env.NODE_ENV === 'production' && isPlaceholderWebhookSecret(webhookSecret)) {
      console.error('RAZORPAY_WEBHOOK_SECRET is not configured in production.');
      return res.status(503).json({ error: { message: 'Webhook verification is not configured.' } });
    }

    const secretForVerify = webhookSecret || 'your_razorpay_webhook_secret_here';
    const hmac = crypto.createHmac('sha256', secretForVerify);
    hmac.update(req.rawBody || '');
    const calculatedSignature = hmac.digest('hex');

    const allowTestMock =
      process.env.NODE_ENV === 'test' &&
      signature.startsWith('mock_sig_') &&
      isPlaceholderWebhookSecret(webhookSecret);

    if (calculatedSignature !== signature && !allowTestMock) {
      return res.status(400).json({ error: { message: 'Invalid webhook signature.' } });
    }

    const { event, payload } = req.body;

    if (event === 'order.paid' || event === 'payment.captured') {
      let razorpayOrderId = null;

      if (payload.order && payload.order.entity) {
        razorpayOrderId = payload.order.entity.id;
      } else if (payload.payment && payload.payment.entity) {
        razorpayOrderId = payload.payment.entity.order_id;
      }

      if (!razorpayOrderId) {
        return res.status(200).json({ status: 'ignored', message: 'Missing razorpay_order_id.' });
      }

      const [orders] = await db.query('SELECT * FROM orders WHERE razorpay_order_id = ?', [razorpayOrderId]);
      if (orders.length === 0) {
        return res.status(200).json({ status: 'ignored', message: 'Local order not found.' });
      }

      const order = orders[0];
      const paymentEntity = payload.payment ? payload.payment.entity : null;
      const paymentId = paymentEntity ? paymentEntity.id : `pay_webhook_${crypto.randomBytes(6).toString('hex')}`;
      const paymentMethod = paymentEntity ? paymentEntity.method : 'Webhook';
      const paymentStatus = paymentEntity ? paymentEntity.status : 'captured';

      const result = await fulfillPaidOrder(order.id, {
        razorpay_order_id: razorpayOrderId,
        razorpay_payment_id: paymentId,
        razorpay_signature: signature,
        payment_method: paymentMethod,
        status: paymentStatus,
      });

      if (!result.fulfilled) {
        if (result.reason === 'already_processed') {
          return res.status(200).json({ status: 'ignored', message: 'Order already processed.' });
        }
        return res.status(200).json({ status: 'ignored', message: result.reason || 'Could not fulfill order.' });
      }

      await db.query(
        'INSERT INTO activity_logs (user_id, action, ip_address) VALUES (?, ?, ?)',
        [order.user_id, `Order Checkout Captured via Webhook - Order ID: ${order.id}`, 'webhook-server']
      );

      return res.status(200).json({ status: 'success', message: 'Order captured via webhook.' });
    }

    res.status(200).json({ status: 'ignored', message: 'Event not handled.' });
  } catch (error) {
    next(error);
  }
};
