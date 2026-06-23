const request = require('supertest');
const app = require('../app');
const db = require('../config/db');
const crypto = require('crypto');

const regularCustomer = {
  email: 'dashboardcustomer@example.com',
  password: 'customerpassword123'
};

const adminUser = {
  email: 'dashboardadmin@example.com',
  password: 'adminpassword123'
};

let customerToken = '';
let adminToken = '';

function hashPassword(password) {
  return crypto.createHash('sha256').update(password).digest('hex');
}

beforeAll(async () => {
  // Clear any existing test accounts
  await db.query('DELETE FROM users WHERE email IN (?, ?)', [regularCustomer.email, adminUser.email]);

  // Register regular customer
  const custRes = await request(app)
    .post('/api/auth/register')
    .send(regularCustomer);
  customerToken = custRes.body.token;

  // Insert admin account
  const passwordHash = hashPassword(adminUser.password);
  await db.query(
    'INSERT INTO users (email, password_hash, role) VALUES (?, ?, ?)',
    [adminUser.email, passwordHash, 'admin']
  );

  // Login admin to retrieve token
  const adminRes = await request(app)
    .post('/api/auth/login')
    .send(adminUser);
  adminToken = adminRes.body.token;
});

afterAll(async () => {
  // Cleanup test users
  await db.query('DELETE FROM users WHERE email IN (?, ?)', [regularCustomer.email, adminUser.email]);
  // Close database pool to avoid open handle warnings in Jest
  await db.end();
});

describe('Admin Dashboard Analytics API (Role Protected)', () => {
  test('GET /api/admin/dashboard - Should fail for unauthenticated requests', async () => {
    const res = await request(app)
      .get('/api/admin/dashboard');

    expect(res.status).toBe(401);
  });

  test('GET /api/admin/dashboard - Should fail (403) for customer role accounts', async () => {
    const res = await request(app)
      .get('/api/admin/dashboard')
      .set('Authorization', `Bearer ${customerToken}`);

    expect(res.status).toBe(403);
    expect(res.body.error).toHaveProperty('message', 'Access denied. Administrator privileges required.');
  });

  test('GET /api/admin/dashboard - Should successfully retrieve dashboard metrics for admin accounts', async () => {
    const res = await request(app)
      .get('/api/admin/dashboard')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('metrics');
    expect(res.body.metrics).toHaveProperty('total_revenue');
    expect(res.body.metrics).toHaveProperty('total_customers');
    expect(res.body.metrics).toHaveProperty('order_stats');
    expect(res.body.metrics).toHaveProperty('low_stock_alerts');
    expect(res.body.metrics).toHaveProperty('recent_logs');
    
    expect(Array.isArray(res.body.metrics.low_stock_alerts)).toBe(true);
    expect(Array.isArray(res.body.metrics.recent_logs)).toBe(true);
  });
});
