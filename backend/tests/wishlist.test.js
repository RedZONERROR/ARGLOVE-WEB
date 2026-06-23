const request = require('supertest');
const app = require('../app');
const db = require('../config/db');

const wishlistUser = {
  email: 'wishlistuser@example.com',
  password: 'wishlistpassword123'
};

let userToken = '';
let activeProductId = null;

async function cleanupUser(email) {
  const [users] = await db.query('SELECT id FROM users WHERE email = ?', [email]);
  if (users.length > 0) {
    const userId = users[0].id;
    await db.query('DELETE FROM wishlist_items WHERE user_id = ?', [userId]);
    await db.query('DELETE FROM users WHERE id = ?', [userId]);
  }
}

beforeAll(async () => {
  // Clear any existing test data
  await cleanupUser(wishlistUser.email);
  
  // Register wishlist test user
  const registerRes = await request(app)
    .post('/api/auth/register')
    .send(wishlistUser);
  userToken = registerRes.body.token;

  // Retrieve an active product ID
  const productsRes = await request(app).get('/api/products');
  if (productsRes.body.products.length > 0) {
    activeProductId = productsRes.body.products[0].id;
  }
});

afterAll(async () => {
  // Cleanup
  await cleanupUser(wishlistUser.email);
  // Close database pool to avoid open handle warnings in Jest
  await db.end();
});

describe('Wishlist API Endpoints (Authenticated)', () => {
  test('GET /api/wishlist - Should retrieve empty wishlist on start', async () => {
    const res = await request(app)
      .get('/api/wishlist')
      .set('Authorization', `Bearer ${userToken}`);

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('wishlist');
    expect(Array.isArray(res.body.wishlist)).toBe(true);
    expect(res.body.wishlist.length).toBe(0);
  });

  test('POST /api/wishlist/add - Should fail without product_id', async () => {
    const res = await request(app)
      .post('/api/wishlist/add')
      .set('Authorization', `Bearer ${userToken}`)
      .send({});

    expect(res.status).toBe(400);
    expect(res.body.error).toHaveProperty('message', 'Product ID is required.');
  });

  test('POST /api/wishlist/add - Should successfully add product to wishlist', async () => {
    if (!activeProductId) {
      console.warn('Skipping test: No active product ID found.');
      return;
    }

    const res = await request(app)
      .post('/api/wishlist/add')
      .set('Authorization', `Bearer ${userToken}`)
      .send({ product_id: activeProductId });

    expect(res.status).toBe(201);
    expect(res.body).toHaveProperty('message', 'Product added to wishlist successfully.');
  });

  test('POST /api/wishlist/add - Should return message when adding duplicate product', async () => {
    if (!activeProductId) return;

    const res = await request(app)
      .post('/api/wishlist/add')
      .set('Authorization', `Bearer ${userToken}`)
      .send({ product_id: activeProductId });

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('message', 'Product is already in your wishlist.');
  });

  test('GET /api/wishlist - Should contain the newly added product', async () => {
    if (!activeProductId) return;

    const res = await request(app)
      .get('/api/wishlist')
      .set('Authorization', `Bearer ${userToken}`);

    expect(res.status).toBe(200);
    expect(res.body.wishlist.length).toBe(1);
    expect(res.body.wishlist[0].product_id).toBe(activeProductId);
  });

  test('DELETE /api/wishlist/remove/:product_id - Should remove product from wishlist', async () => {
    if (!activeProductId) return;

    const res = await request(app)
      .delete(`/api/wishlist/remove/${activeProductId}`)
      .set('Authorization', `Bearer ${userToken}`);

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('message', 'Product removed from wishlist successfully.');

    // Verify empty
    const checkRes = await request(app)
      .get('/api/wishlist')
      .set('Authorization', `Bearer ${userToken}`);
    expect(checkRes.body.wishlist.length).toBe(0);
  });
});
