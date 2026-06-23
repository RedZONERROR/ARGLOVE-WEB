const request = require('supertest');
const app = require('../app');
const db = require('../config/db');

afterAll(async () => {
  // Close database pool to avoid open handle warnings in Jest
  await db.end();
});

describe('Products and Categories API Endpoints', () => {
  let firstProductId = null;

  test('GET /api/products - Should retrieve a list of published products', async () => {
    const res = await request(app)
      .get('/api/products');

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('products');
    expect(Array.isArray(res.body.products)).toBe(true);

    if (res.body.products.length > 0) {
      firstProductId = res.body.products[0].id;
    }
  });

  test('GET /api/products - Should filter products by search query', async () => {
    const res = await request(app)
      .get('/api/products?search=Running');

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('products');
    // All returned products should match or we should get a valid list
    res.body.products.forEach(product => {
      const match = product.name.toLowerCase().includes('running') || 
                    product.description.toLowerCase().includes('running');
      expect(match).toBe(true);
    });
  });

  test('GET /api/products/categories - Should retrieve a list of categories', async () => {
    const res = await request(app)
      .get('/api/products/categories');

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('categories');
    expect(Array.isArray(res.body.categories)).toBe(true);
    expect(res.body.categories.length).toBeGreaterThan(0);
  });

  test('GET /api/products/:id - Should retrieve product detail and resources', async () => {
    if (!firstProductId) {
      console.warn('Skipping test: No product ID available.');
      return;
    }

    const res = await request(app)
      .get(`/api/products/${firstProductId}`);

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('product');
    expect(res.body.product.id).toBe(firstProductId);
    expect(res.body).toHaveProperty('resources');
    expect(Array.isArray(res.body.resources)).toBe(true);
  });

  test('GET /api/products/:id - Should return 404 for invalid product ID', async () => {
    const res = await request(app)
      .get('/api/products/999999');

    expect(res.status).toBe(404);
    expect(res.body.error).toHaveProperty('message', 'Product not found.');
  });
});
