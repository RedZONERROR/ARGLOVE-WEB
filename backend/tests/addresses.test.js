const request = require('supertest');
const app = require('../app');
const db = require('../config/db');

const userA = {
  email: 'usera@example.com',
  password: 'userapassword123'
};

const userB = {
  email: 'userb@example.com',
  password: 'userbpassword123'
};

let tokenA = '';
let tokenB = '';
let testAddressId = null;

async function cleanupUser(email) {
  const [users] = await db.query('SELECT id FROM users WHERE email = ?', [email]);
  if (users.length > 0) {
    const userId = users[0].id;
    await db.query('DELETE FROM user_addresses WHERE user_id = ?', [userId]);
    await db.query('DELETE FROM users WHERE id = ?', [userId]);
  }
}

beforeAll(async () => {
  // Clear any existing test user & addresses details
  await cleanupUser(userA.email);
  await cleanupUser(userB.email);
  
  // Register user A & B
  const resA = await request(app).post('/api/auth/register').send(userA);
  const resB = await request(app).post('/api/auth/register').send(userB);

  tokenA = resA.body.token;
  tokenB = resB.body.token;
});

afterAll(async () => {
  // Cleanup
  await cleanupUser(userA.email);
  await cleanupUser(userB.email);
  // Close database pool to avoid open handle warnings in Jest
  await db.end();
});

describe('User Address API Endpoints (Authenticated)', () => {
  test('POST /api/addresses - Should successfully add a new address', async () => {
    const res = await request(app)
      .post('/api/addresses')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({
        address_type: 'shipping',
        recipient_name: 'Alice Johnson',
        street_address: '456 Oak Avenue',
        city: 'Pune',
        state: 'Maharashtra',
        postal_code: '411001',
        phone_number: '+919999988888'
      });

    expect(res.status).toBe(201);
    expect(res.body).toHaveProperty('address');
    expect(res.body.address).toHaveProperty('street_address', '456 Oak Avenue');
    testAddressId = res.body.address.id;
  });

  test('PUT /api/addresses/:id - Should successfully update own address details', async () => {
    if (!testAddressId) return;

    const res = await request(app)
      .put(`/api/addresses/${testAddressId}`)
      .set('Authorization', `Bearer ${tokenA}`)
      .send({
        address_type: 'shipping',
        recipient_name: 'Alice Johnson (Updated)',
        street_address: '789 Pine Road',
        city: 'Pune',
        state: 'Maharashtra',
        postal_code: '411002',
        phone_number: '+919999988888'
      });

    expect(res.status).toBe(200);
    expect(res.body.address).toHaveProperty('recipient_name', 'Alice Johnson (Updated)');
    expect(res.body.address).toHaveProperty('street_address', '789 Pine Road');
  });

  test('PUT /api/addresses/:id - Should fail (403) when updating another user\'s address', async () => {
    if (!testAddressId) return;

    const res = await request(app)
      .put(`/api/addresses/${testAddressId}`)
      .set('Authorization', `Bearer ${tokenB}`)
      .send({
        address_type: 'shipping',
        recipient_name: 'Hacker Bob',
        street_address: '666 Hack Street',
        city: 'Mumbai',
        state: 'Maharashtra',
        postal_code: '400001',
        phone_number: '+919876543210'
      });

    expect(res.status).toBe(403);
    expect(res.body.error).toHaveProperty('message', 'Access denied. You do not own this address.');
  });

  test('DELETE /api/addresses/:id - Should fail (403) when deleting another user\'s address', async () => {
    if (!testAddressId) return;

    const res = await request(app)
      .delete(`/api/addresses/${testAddressId}`)
      .set('Authorization', `Bearer ${tokenB}`);

    expect(res.status).toBe(403);
    expect(res.body.error).toHaveProperty('message', 'Access denied. You do not own this address.');
  });

  test('DELETE /api/addresses/:id - Should successfully delete own address', async () => {
    if (!testAddressId) return;

    const res = await request(app)
      .delete(`/api/addresses/${testAddressId}`)
      .set('Authorization', `Bearer ${tokenA}`);

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('message', 'Address deleted successfully.');
  });

  test('DELETE /api/addresses/:id - Should return 404 for deleted or non-existent address', async () => {
    const res = await request(app)
      .delete('/api/addresses/999999')
      .set('Authorization', `Bearer ${tokenA}`);

    expect(res.status).toBe(404);
  });
});
