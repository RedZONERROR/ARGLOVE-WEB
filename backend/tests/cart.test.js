const request = require('supertest');
const app = require('../app');
const db = require('../config/db');

const cartUser = {
  email: 'cartuser@example.com',
  password: 'cartpassword123'
};

let userToken = '';
let activeProductId = null;

beforeAll(async () => {
  // Clear any existing test user & cart details
  await db.query('DELETE FROM users WHERE email = ?', [cartUser.email]);
  
  // Register the user to get a token
  const registerRes = await request(app)
    .post('/api/auth/register')
    .send(cartUser);
  userToken = registerRes.body.token;

  // Retrieve an active product ID dynamically
  const productsRes = await request(app).get('/api/products');
  if (productsRes.body.products.length > 0) {
    activeProductId = productsRes.body.products[0].id;
  }
});

afterAll(async () => {
  // Cleanup test user (Cascades delete to carts and cart_items)
  await db.query('DELETE FROM users WHERE email = ?', [cartUser.email]);
  // Close database pool to avoid open handle warnings in Jest
  await db.end();
});

describe('Cart API Endpoints (Authenticated)', () => {
  test('GET /api/cart - Should get user cart details (starts empty)', async () => {
    const res = await request(app)
      .get('/api/cart')
      .set('Authorization', `Bearer ${userToken}`);

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('items');
    expect(Array.isArray(res.body.items)).toBe(true);
    expect(res.body.items.length).toBe(0);
  });

  test('POST /api/cart/add - Should add a product to the cart', async () => {
    if (!activeProductId) {
      console.warn('Skipping test: No active product ID found.');
      return;
    }

    const res = await request(app)
      .post('/api/cart/add')
      .set('Authorization', `Bearer ${userToken}`)
      .send({ product_id: activeProductId, quantity: 2 });

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('message', 'Product added to cart successfully.');
  });

  test('GET /api/cart - Should now contain the added item', async () => {
    if (!activeProductId) return;

    const res = await request(app)
      .get('/api/cart')
      .set('Authorization', `Bearer ${userToken}`);

    expect(res.status).toBe(200);
    expect(res.body.items.length).toBe(1);
    expect(res.body.items[0].product_id).toBe(activeProductId);
    expect(res.body.items[0].quantity).toBe(2);
  });

  test('PUT /api/cart/update - Should update item quantity in cart', async () => {
    if (!activeProductId) return;

    const res = await request(app)
      .put('/api/cart/update')
      .set('Authorization', `Bearer ${userToken}`)
      .send({ product_id: activeProductId, quantity: 5 });

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('message', 'Cart updated successfully.');

    // Verify change
    const checkRes = await request(app)
      .get('/api/cart')
      .set('Authorization', `Bearer ${userToken}`);
    expect(checkRes.body.items[0].quantity).toBe(5);
  });

  test('DELETE /api/cart/remove/:product_id - Should remove item from cart', async () => {
    if (!activeProductId) return;

    const res = await request(app)
      .delete(`/api/cart/remove/${activeProductId}`)
      .set('Authorization', `Bearer ${userToken}`);

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('message', 'Product removed from cart successfully.');

    // Verify empty
    const checkRes = await request(app)
      .get('/api/cart')
      .set('Authorization', `Bearer ${userToken}`);
    expect(checkRes.body.items.length).toBe(0);
  });
});
