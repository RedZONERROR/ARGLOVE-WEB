const request = require('supertest');
const app = require('../app');
const db = require('../config/db');

const testUser = {
  email: 'testuser@example.com',
  password: 'testpassword123'
};

beforeAll(async () => {
  // Clear any existing test users to prevent unique constraint errors
  await db.query('DELETE FROM users WHERE email = ?', [testUser.email]);
});

afterAll(async () => {
  // Clean up
  await db.query('DELETE FROM users WHERE email = ?', [testUser.email]);
  // Close database pool to avoid open handle warnings in Jest
  await db.end();
});

describe('Authentication API Endpoints', () => {
  let userToken = '';

  test('POST /api/auth/register - Should register a new user successfully', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send(testUser);

    expect(res.status).toBe(201);
    expect(res.body).toHaveProperty('token');
    expect(res.body.user).toHaveProperty('email', testUser.email);
    userToken = res.body.token;
  });

  test('POST /api/auth/register - Should fail if email is already registered', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send(testUser);

    expect(res.status).toBe(400);
    expect(res.body.error).toHaveProperty('message', 'Email is already registered.');
  });

  test('POST /api/auth/login - Should login successfully with correct credentials', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send(testUser);

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('token');
  });

  test('POST /api/auth/login - Should fail with wrong password', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({
        email: testUser.email,
        password: 'wrongpassword'
      });

    expect(res.status).toBe(401);
    expect(res.body.error).toHaveProperty('message', 'Invalid credentials.');
  });

  test('GET /api/auth/profile - Should fail without authorization token', async () => {
    const res = await request(app)
      .get('/api/auth/profile');

    expect(res.status).toBe(401);
  });

  test('GET /api/auth/profile - Should retrieve user profile with valid JWT', async () => {
    const res = await request(app)
      .get('/api/auth/profile')
      .set('Authorization', `Bearer ${userToken}`);

    expect(res.status).toBe(200);
    expect(res.body.user).toHaveProperty('email', testUser.email);
  });
});
