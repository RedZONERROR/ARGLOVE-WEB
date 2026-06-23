const request = require('supertest');
const app = require('../app');
const db = require('../config/db');

const orderUser = {
  email: 'orderuser@example.com',
  password: 'orderpassword123'
};

let userToken = '';
let activeProductId = null;
let razorpayOrderId = '';
let localOrderId = null;

async function cleanupUser(email) {
  const [users] = await db.query('SELECT id FROM users WHERE email = ?', [email]);
  if (users.length > 0) {
    const userId = users[0].id;
    const [orders] = await db.query('SELECT id FROM orders WHERE user_id = ?', [userId]);
    const orderIds = orders.map(o => o.id);
    
    if (orderIds.length > 0) {
      // Delete payments pointing to these orders
      await db.query('DELETE FROM payments WHERE order_id IN (?)', [orderIds]);
      // Delete order items
      await db.query('DELETE FROM order_items WHERE order_id IN (?)', [orderIds]);
      // Delete orders
      await db.query('DELETE FROM orders WHERE user_id = ?', [userId]);
    }

    // Delete user addresses
    await db.query('DELETE FROM user_addresses WHERE user_id = ?', [userId]);
    // Delete activity logs
    await db.query('DELETE FROM activity_logs WHERE user_id = ?', [userId]);

    // Delete cart & items
    const [carts] = await db.query('SELECT id FROM carts WHERE user_id = ?', [userId]);
    if (carts.length > 0) {
      await db.query('DELETE FROM cart_items WHERE cart_id = ?', [carts[0].id]);
      await db.query('DELETE FROM carts WHERE user_id = ?', [userId]);
    }

    // Finally, delete the user
    await db.query('DELETE FROM users WHERE id = ?', [userId]);
  }
}

beforeAll(async () => {
  // Clear any existing test data using clean order
  await cleanupUser(orderUser.email);
  
  // Register order test user
  const registerRes = await request(app)
    .post('/api/auth/register')
    .send(orderUser);
  userToken = registerRes.body.token;

  // Retrieve an active product ID
  const productsRes = await request(app).get('/api/products');
  if (productsRes.body.products.length > 0) {
    activeProductId = productsRes.body.products[0].id;
  }

  // Add the product to the user's cart
  if (activeProductId) {
    await request(app)
      .post('/api/cart/add')
      .set('Authorization', `Bearer ${userToken}`)
      .send({ product_id: activeProductId, quantity: 1 });
  }
});

afterAll(async () => {
  // Cleanup test user
  await cleanupUser(orderUser.email);
  // Close database pool to avoid open handle warnings in Jest
  await db.end();
});

describe('Orders and Razorpay API Endpoints (Authenticated)', () => {
  test('POST /api/orders/create - Should fail without shipping address', async () => {
    const res = await request(app)
      .post('/api/orders/create')
      .set('Authorization', `Bearer ${userToken}`)
      .send({});

    expect(res.status).toBe(400);
    expect(res.body.error).toHaveProperty('message', 'Shipping address is required.');
  });

  test('POST /api/orders/create - Should successfully create a checkout order', async () => {
    if (!activeProductId) {
      console.warn('Skipping test: No active product ID found.');
      return;
    }

    const res = await request(app)
      .post('/api/orders/create')
      .set('Authorization', `Bearer ${userToken}`)
      .send({ shipping_address: '123 Test Street, Mumbai, India' });

    expect(res.status).toBe(201);
    expect(res.body).toHaveProperty('order_id');
    expect(res.body).toHaveProperty('razorpay_order_id');
    expect(res.body.razorpay_order_id).toContain('order_');
    
    localOrderId = res.body.order_id;
    razorpayOrderId = res.body.razorpay_order_id;
  });

  test('POST /api/orders/verify - Should fail if verification parameters are missing', async () => {
    const res = await request(app)
      .post('/api/orders/verify')
      .set('Authorization', `Bearer ${userToken}`)
      .send({});

    expect(res.status).toBe(400);
    expect(res.body.error).toHaveProperty('message', 'Missing payment signature verification parameters.');
  });

  test('POST /api/orders/verify - Should verify and capture mock payments', async () => {
    if (!razorpayOrderId) return;

    const res = await request(app)
      .post('/api/orders/verify')
      .set('Authorization', `Bearer ${userToken}`)
      .send({
        razorpay_order_id: razorpayOrderId,
        razorpay_payment_id: 'pay_test123456',
        razorpay_signature: 'mock_sig_hash123'
      });

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('message', 'Payment verified and order captured successfully.');
    expect(res.body.order_id).toBe(localOrderId);
  });

  test('GET /api/orders/history - Should retrieve user checkout history', async () => {
    const res = await request(app)
      .get('/api/orders/history')
      .set('Authorization', `Bearer ${userToken}`);

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('orders');
    expect(Array.isArray(res.body.orders)).toBe(true);
    expect(res.body.orders.length).toBeGreaterThan(0);
    expect(res.body.orders[0].id).toBe(localOrderId);
    expect(res.body.orders[0].items.length).toBe(1);
  });

  test('GET /api/cart - Cart should be cleared after successful checkout capture', async () => {
    const res = await request(app)
      .get('/api/cart')
      .set('Authorization', `Bearer ${userToken}`);

    expect(res.status).toBe(200);
    expect(res.body.items.length).toBe(0);
  });
});
