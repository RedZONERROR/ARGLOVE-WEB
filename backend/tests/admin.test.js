const request = require('supertest');
const app = require('../app');
const db = require('../config/db');
const crypto = require('crypto');

const regularUser = {
  email: 'regularadmin@example.com',
  password: 'regularpassword123'
};

const adminUser = {
  email: 'realadmin@example.com',
  password: 'adminpassword123'
};

let regularToken = '';
let adminToken = '';
let testProductId = null;

// Secure password hash helper
function hashPassword(password) {
  return crypto.createHash('sha256').update(password).digest('hex');
}

beforeAll(async () => {
  // Clear any existing test accounts
  await db.query('DELETE FROM users WHERE email IN (?, ?)', [regularUser.email, adminUser.email]);

  // Register regular customer user
  const regularRes = await request(app)
    .post('/api/auth/register')
    .send(regularUser);
  regularToken = regularRes.body.token;

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
});

afterAll(async () => {
  // Cleanup products created by tests to avoid polluting database
  if (testProductId) {
    await db.query('DELETE FROM products WHERE id = ?', [testProductId]);
  }
  await db.query('DELETE FROM users WHERE email IN (?, ?)', [regularUser.email, adminUser.email]);
  // Close database pool to avoid open handle warnings in Jest
  await db.end();
});

describe('Admin CRUD API Endpoints', () => {
  test('POST /api/admin/products - Should fail for unauthenticated requests', async () => {
    const res = await request(app)
      .post('/api/admin/products')
      .send({
        name: 'Unauth Shoe',
        description: 'Should not create',
        regular_price: 100
      });

    expect(res.status).toBe(401);
  });

  test('POST /api/admin/products - Should fail (403) for non-admin accounts', async () => {
    const res = await request(app)
      .post('/api/admin/products')
      .set('Authorization', `Bearer ${regularToken}`)
      .send({
        name: 'Customer Shoe',
        description: 'Should not be allowed',
        regular_price: 1500
      });

    expect(res.status).toBe(403);
    expect(res.body.error).toHaveProperty('message', 'Access denied. Administrator privileges required.');
  });

  test('POST /api/admin/products - Should successfully create a product with admin privileges', async () => {
    const res = await request(app)
      .post('/api/admin/products')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        name: 'Admin Sports Shoe',
        description: 'Premium quality sports running shoes',
        regular_price: 4999.00,
        stock_quantity: 20
      });

    expect(res.status).toBe(201);
    expect(res.body).toHaveProperty('message', 'Product created successfully.');
    expect(res.body.product).toHaveProperty('name', 'Admin Sports Shoe');
    expect(res.body.product.is_published).toBe(true);

    testProductId = res.body.product.id;
  });

  test('PUT /api/admin/products/:id - Should successfully update product details', async () => {
    if (!testProductId) return;

    const res = await request(app)
      .put(`/api/admin/products/${testProductId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        name: 'Admin Sports Shoe (Updated)',
        description: 'Updated premium running shoes with extra comfort',
        regular_price: 5499.00,
        stock_quantity: 15
      });

    expect(res.status).toBe(200);
    expect(res.body.product).toHaveProperty('name', 'Admin Sports Shoe (Updated)');
    expect(res.body.product).toHaveProperty('regular_price', 5499.00);
    expect(res.body.product).toHaveProperty('stock_quantity', 15);
  });

  test('DELETE /api/admin/products/:id - Should soft-archive (is_published = false) product instead of deletion', async () => {
    if (!testProductId) return;

    const res = await request(app)
      .delete(`/api/admin/products/${testProductId}`)
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('message', 'Product archived successfully.');

    // Verify it is archived in local database
    const [rows] = await db.query('SELECT is_published FROM products WHERE id = ?', [testProductId]);
    expect(rows[0].is_published).toBe(0); // FALSE/0 in MySQL
  });

  test('POST /api/admin/categories - Should successfully create a new category', async () => {
    const uniqueSlug = 'cat-slug-' + crypto.randomBytes(4).toString('hex');
    const res = await request(app)
      .post('/api/admin/categories')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        name: 'Test Category',
        slug: uniqueSlug
      });

    expect(res.status).toBe(201);
    expect(res.body).toHaveProperty('message', 'Category created successfully.');
    expect(res.body.category).toHaveProperty('name', 'Test Category');

    // Clean up created test category
    await db.query('DELETE FROM categories WHERE id = ?', [res.body.category.id]);
  });
});
