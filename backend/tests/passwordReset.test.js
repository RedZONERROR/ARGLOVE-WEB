const request = require('supertest');
const app = require('../app');
const db = require('../config/db');

const testUser = {
  email: 'reset_test@example.com',
  password: 'originalPassword123'
};

beforeAll(async () => {
  // Clear any existing test users to prevent unique constraint errors
  await db.query('DELETE FROM users WHERE email = ?', [testUser.email]);
  // Register the test user
  await request(app)
    .post('/api/auth/register')
    .send(testUser);
});

afterAll(async () => {
  // Clean up
  await db.query('DELETE FROM users WHERE email = ?', [testUser.email]);
  // Close database pool to avoid open handle warnings in Jest
  await db.end();
});

describe('Password Reset API Endpoints', () => {
  let resetToken = '';

  test('POST /api/auth/forgot-password - Should generate reset token for existing email', async () => {
    const res = await request(app)
      .post('/api/auth/forgot-password')
      .send({ email: testUser.email });

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('message');
    expect(res.body).toHaveProperty('token');
    expect(res.body).toHaveProperty('resetUrl');
    resetToken = res.body.token;
  });

  test('POST /api/auth/forgot-password - Should fail for non-existing email', async () => {
    const res = await request(app)
      .post('/api/auth/forgot-password')
      .send({ email: 'doesnotexist@example.com' });

    expect(res.status).toBe(404);
    expect(res.body.error).toHaveProperty('message', 'User with this email does not exist.');
  });

  test('POST /api/auth/forgot-password - Should fail if email is not provided', async () => {
    const res = await request(app)
      .post('/api/auth/forgot-password')
      .send({});

    expect(res.status).toBe(400);
    expect(res.body.error).toHaveProperty('message', 'Email is required.');
  });

  test('POST /api/auth/reset-password - Should reset password successfully with valid token', async () => {
    const newPassword = 'newSecretPassword123';
    const res = await request(app)
      .post('/api/auth/reset-password')
      .send({
        token: resetToken,
        password: newPassword
      });

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('message', 'Password has been reset successfully.');

    // Verify we can login with the new password
    const loginRes = await request(app)
      .post('/api/auth/login')
      .send({
        email: testUser.email,
        password: newPassword
      });
    expect(loginRes.status).toBe(200);
    expect(loginRes.body).toHaveProperty('token');
  });

  test('POST /api/auth/reset-password - Should fail with invalid token', async () => {
    const res = await request(app)
      .post('/api/auth/reset-password')
      .send({
        token: 'invalidtoken1234567890',
        password: 'someNewPassword'
      });

    expect(res.status).toBe(400);
    expect(res.body.error).toHaveProperty('message', 'Invalid or expired token.');
  });

  test('POST /api/auth/reset-password - Should fail if token or password is missing', async () => {
    const res = await request(app)
      .post('/api/auth/reset-password')
      .send({
        token: 'token'
      });

    expect(res.status).toBe(400);
    expect(res.body.error).toHaveProperty('message', 'Token and new password are required.');
  });
});
