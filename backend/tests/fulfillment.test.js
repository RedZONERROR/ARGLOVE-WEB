const request = require('supertest');
const app = require('../app');
const db = require('../config/db');
const crypto = require('crypto');

const customerUser = {
  email: 'fulfillment_customer@example.com',
  password: 'customerPassword123'
};

const adminUser = {
  email: 'fulfillment_admin@example.com',
  password: 'adminPassword123'
};

let customerToken = '';
let adminToken = '';
let customerId = null;
let testProduct1Id = null;
let testProduct2Id = null;

// Secure password hash helper
function hashPassword(password) {
  return crypto.createHash('sha256').update(password).digest('hex');
}

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

    const [carts] = await db.query('SELECT id FROM carts WHERE user_id = ?', [userId]);
    if (carts.length > 0) {
      await db.query('DELETE FROM cart_items WHERE cart_id = ?', [carts[0].id]);
      await db.query('DELETE FROM carts WHERE user_id = ?', [userId]);
    }

    await db.query('DELETE FROM users WHERE id = ?', [userId]);
  }
}

beforeAll(async () => {
  // Clear any existing test accounts/data
  await cleanupUser(customerUser.email);
  await cleanupUser(adminUser.email);

  // Register customer
  const custRes = await request(app)
    .post('/api/auth/register')
    .send(customerUser);
  customerToken = custRes.body.token;
  customerId = custRes.body.user.id;

  // Insert admin account directly in database
  const passwordHash = hashPassword(adminUser.password);
  await db.query(
    'INSERT INTO users (email, password_hash, role) VALUES (?, ?, ?)',
    [adminUser.email, passwordHash, 'admin']
  );

  // Login admin user to retrieve token
  const adminRes = await request(app)
    .post('/api/auth/login')
    .send(adminUser);
  adminToken = adminRes.body.token;

  // Create temporary products for testing
  const [prod1] = await db.query(
    'INSERT INTO products (name, description, regular_price, stock_quantity) VALUES (?, ?, ?, ?)',
    ['Fulfillment Test Shoe 1', 'Testing stock levels', 3000.00, 20]
  );
  testProduct1Id = prod1.insertId;

  const [prod2] = await db.query(
    'INSERT INTO products (name, description, regular_price, stock_quantity) VALUES (?, ?, ?, ?)',
    ['Fulfillment Test Shoe 2', 'Testing stock levels 2', 4000.00, 10]
  );
  testProduct2Id = prod2.insertId;
});

afterAll(async () => {
  // Cleanup test user and admin
  await cleanupUser(customerUser.email);
  await cleanupUser(adminUser.email);

  // Clean up products
  if (testProduct1Id) {
    await db.query('DELETE FROM products WHERE id = ?', [testProduct1Id]);
  }
  if (testProduct2Id) {
    await db.query('DELETE FROM products WHERE id = ?', [testProduct2Id]);
  }

  // Close pool
  await db.end();
});

describe('Admin Order Fulfillment API Endpoints', () => {
  let order1Id = null;
  let order2Id = null;
  let order2RazorpayId = '';

  test('POST /api/orders/create - Setup orders for testing status change', async () => {
    // 1. Setup Order 1 (for testing pending cancellation)
    await request(app)
      .post('/api/cart/add')
      .set('Authorization', `Bearer ${customerToken}`)
      .send({ product_id: testProduct1Id, quantity: 2 });

    const order1Res = await request(app)
      .post('/api/orders/create')
      .set('Authorization', `Bearer ${customerToken}`)
      .send({ shipping_address: 'Fulfillment Address 1' });

    expect(order1Res.status).toBe(201);
    order1Id = order1Res.body.order_id;

    // 2. Setup Order 2 (for testing paid order cancellation)
    // Clear cart first so Product 1 is not carried over to Order 2
    const [carts] = await db.query('SELECT id FROM carts WHERE user_id = ?', [customerId]);
    if (carts.length > 0) {
      await db.query('DELETE FROM cart_items WHERE cart_id = ?', [carts[0].id]);
    }

    await request(app)
      .post('/api/cart/add')
      .set('Authorization', `Bearer ${customerToken}`)
      .send({ product_id: testProduct2Id, quantity: 3 });

    const order2Res = await request(app)
      .post('/api/orders/create')
      .set('Authorization', `Bearer ${customerToken}`)
      .send({ shipping_address: 'Fulfillment Address 2' });

    expect(order2Res.status).toBe(201);
    order2Id = order2Res.body.order_id;
    order2RazorpayId = order2Res.body.razorpay_order_id;

    // Verify payment for Order 2 so it transitions to processing and decrements stock
    const verifyRes = await request(app)
      .post('/api/orders/verify')
      .set('Authorization', `Bearer ${customerToken}`)
      .send({
        razorpay_order_id: order2RazorpayId,
        razorpay_payment_id: 'pay_fulfill_123',
        razorpay_signature: 'mock_sig_fulfill'
      });
    expect(verifyRes.status).toBe(200);

    // Verify stock has been decremented for Product 2 (10 - 3 = 7)
    const [prod2Rows] = await db.query('SELECT stock_quantity FROM products WHERE id = ?', [testProduct2Id]);
    expect(prod2Rows[0].stock_quantity).toBe(7);
  });

  test('PUT /api/admin/orders/:id/status - Should fail if unauthorized', async () => {
    const res = await request(app)
      .put(`/api/admin/orders/${order1Id}/status`)
      .send({ status: 'processing' });

    expect(res.status).toBe(401);
  });

  test('PUT /api/admin/orders/:id/status - Should fail (403) for non-admin accounts', async () => {
    const res = await request(app)
      .put(`/api/admin/orders/${order1Id}/status`)
      .set('Authorization', `Bearer ${customerToken}`)
      .send({ status: 'processing' });

    expect(res.status).toBe(403);
    expect(res.body.error).toHaveProperty('message', 'Access denied. Administrator privileges required.');
  });

  test('PUT /api/admin/orders/:id/status - Should fail with invalid status value', async () => {
    const res = await request(app)
      .put(`/api/admin/orders/${order1Id}/status`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ status: 'invalid_status_value' });

    expect(res.status).toBe(400);
    expect(res.body.error).toHaveProperty('message', 'Invalid order status.');
  });

  test('PUT /api/admin/orders/:id/status - Should fail for non-existing order ID', async () => {
    const res = await request(app)
      .put('/api/admin/orders/9999999/status')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ status: 'processing' });

    expect(res.status).toBe(404);
    expect(res.body.error).toHaveProperty('message', 'Order not found.');
  });

  test('PUT /api/admin/orders/:id/status - Admin should successfully update order status', async () => {
    const res = await request(app)
      .put(`/api/admin/orders/${order1Id}/status`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ status: 'processing' });

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('message', 'Order status updated successfully.');
    expect(res.body.status).toBe('processing');

    const [rows] = await db.query('SELECT status FROM orders WHERE id = ?', [order1Id]);
    expect(rows[0].status).toBe('processing');
  });

  test('PUT /api/admin/orders/:id/status - Cancelling a pending order should NOT increment stock (since stock was never decremented)', async () => {
    // Let's create a fresh pending order with Product 1 (stock currently is 20)
    // Clear cart first just in case
    const [carts] = await db.query('SELECT id FROM carts WHERE user_id = ?', [customerId]);
    if (carts.length > 0) {
      await db.query('DELETE FROM cart_items WHERE cart_id = ?', [carts[0].id]);
    }

    await request(app)
      .post('/api/cart/add')
      .set('Authorization', `Bearer ${customerToken}`)
      .send({ product_id: testProduct1Id, quantity: 5 });

    const orderRes = await request(app)
      .post('/api/orders/create')
      .set('Authorization', `Bearer ${customerToken}`)
      .send({ shipping_address: 'Fulfillment Address 3' });

    const pendingOrderId = orderRes.body.order_id;

    // Verify stock is still 20
    const [prod1Before] = await db.query('SELECT stock_quantity FROM products WHERE id = ?', [testProduct1Id]);
    expect(prod1Before[0].stock_quantity).toBe(20);

    // Cancel this pending order
    const cancelRes = await request(app)
      .put(`/api/admin/orders/${pendingOrderId}/status`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ status: 'cancelled' });

    expect(cancelRes.status).toBe(200);

    // Verify stock is still 20 (not 25!)
    const [prod1After] = await db.query('SELECT stock_quantity FROM products WHERE id = ?', [testProduct1Id]);
    expect(prod1After[0].stock_quantity).toBe(20);
  });

  test('PUT /api/admin/orders/:id/status - Cancelling a processing order should restore stock', async () => {
    // Order 2 is currently 'processing', and Product 2 stock is 7 (originally 10, ordered 3)
    const [prod2Before] = await db.query('SELECT stock_quantity FROM products WHERE id = ?', [testProduct2Id]);
    expect(prod2Before[0].stock_quantity).toBe(7);

    // Cancel Order 2
    const cancelRes = await request(app)
      .put(`/api/admin/orders/${order2Id}/status`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ status: 'cancelled' });

    expect(cancelRes.status).toBe(200);

    // Verify stock is restored to 10
    const [prod2After] = await db.query('SELECT stock_quantity FROM products WHERE id = ?', [testProduct2Id]);
    expect(prod2After[0].stock_quantity).toBe(10);
  });
});
