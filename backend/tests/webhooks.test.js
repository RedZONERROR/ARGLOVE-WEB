const request = require('supertest');
const app = require('../app');
const db = require('../config/db');
const crypto = require('crypto');

const webhookUser = {
  email: 'webhookuser@example.com',
  password: 'webhookpassword123'
};

let userToken = '';
let activeProductId = null;
let localOrderId = null;
const mockRazorpayOrderId = 'order_webhook_test_' + crypto.randomBytes(4).toString('hex');

async function cleanupUser(email) {
  const [users] = await db.query('SELECT id FROM users WHERE email = ?', [email]);
  if (users.length > 0) {
    const userId = users[0].id;
    const [orders] = await db.query('SELECT id FROM orders WHERE user_id = ?', [userId]);
    const orderIds = orders.map(o => o.id);
    
    if (orderIds.length > 0) {
      await db.query('DELETE FROM payments WHERE order_id IN (?)', [orderIds]);
      await db.query('DELETE FROM order_items WHERE order_id IN (?)', [orderIds]);
      await db.query('DELETE FROM orders WHERE user_id = ?', [userId]);
    }
    await db.query('DELETE FROM user_addresses WHERE user_id = ?', [userId]);
    await db.query('DELETE FROM activity_logs WHERE user_id = ?', [userId]);
    await db.query('DELETE FROM users WHERE id = ?', [userId]);
  }
}

beforeAll(async () => {
  // Clear any existing test user & order details
  await cleanupUser(webhookUser.email);
  
  // Register the user to get a token
  const registerRes = await request(app)
    .post('/api/auth/register')
    .send(webhookUser);
  userToken = registerRes.body.token;

  // Retrieve an active product ID dynamically
  const productsRes = await request(app).get('/api/products');
  if (productsRes.body.products.length > 0) {
    activeProductId = productsRes.body.products[0].id;
  }

  // Create a local order pre-initialized with our mock Razorpay Order ID
  if (activeProductId && registerRes.body.user) {
    const userId = registerRes.body.user.id;
    const [orderResult] = await db.query(
      `INSERT INTO orders (user_id, promo_code_id, total_amount, shipping_address, razorpay_order_id, status) 
       VALUES (?, null, 1999.00, '123 Webhook Lane', ?, 'pending')`,
      [userId, mockRazorpayOrderId]
    );
    localOrderId = orderResult.insertId;

    await db.query(
      'INSERT INTO order_items (order_id, product_id, quantity, price_at_purchase) VALUES (?, ?, 1, 1999.00)',
      [localOrderId, activeProductId]
    );
  }
});

afterAll(async () => {
  // Cleanup test user
  await cleanupUser(webhookUser.email);
  // Close database pool to avoid open handle warnings in Jest
  await db.end();
});

describe('Razorpay Webhook API Endpoints', () => {
  test('POST /api/payments/webhook - Should fail with missing signature header', async () => {
    const res = await request(app)
      .post('/api/payments/webhook')
      .send({ event: 'order.paid' });

    expect(res.status).toBe(400);
    expect(res.body.error).toHaveProperty('message', 'Missing webhook signature header.');
  });

  test('POST /api/payments/webhook - Should fail with invalid signature', async () => {
    const res = await request(app)
      .post('/api/payments/webhook')
      .set('x-razorpay-signature', 'invalid_signature')
      .send({ event: 'order.paid' });

    expect(res.status).toBe(400);
    expect(res.body.error).toHaveProperty('message', 'Invalid webhook signature.');
  });

  test('POST /api/payments/webhook - Should process valid webhook and update local order', async () => {
    const payload = {
      event: 'order.paid',
      payload: {
        order: {
          entity: {
            id: mockRazorpayOrderId,
            amount: 199900 // in paise
          }
        },
        payment: {
          entity: {
            id: 'pay_mock_webhook_123',
            method: 'upi',
            status: 'captured',
            amount: 199900
          }
        }
      }
    };

    const webhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET || 'your_razorpay_webhook_secret_here';
    
    // Generate signature using hmac of the exact raw JSON string
    const rawBody = JSON.stringify(payload);
    const hmac = crypto.createHmac('sha256', webhookSecret);
    hmac.update(rawBody);
    const signature = hmac.digest('hex');

    const res = await request(app)
      .post('/api/payments/webhook')
      .set('x-razorpay-signature', signature)
      .set('Content-Type', 'application/json')
      .send(rawBody);

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('status', 'success');

    // Verify order status updated to 'processing' in local DB
    const [orders] = await db.query('SELECT * FROM orders WHERE id = ?', [localOrderId]);
    expect(orders[0].status).toBe('processing');

    // Verify transaction recorded in local payments table
    const [payments] = await db.query('SELECT * FROM payments WHERE order_id = ?', [localOrderId]);
    expect(payments.length).toBe(1);
    expect(payments[0].razorpay_payment_id).toBe('pay_mock_webhook_123');
    expect(payments[0].status).toBe('captured');
  });
});
