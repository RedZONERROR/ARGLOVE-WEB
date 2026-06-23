const request = require('supertest');
const app = require('../app');
const db = require('../config/db');

afterAll(async () => {
  // Close database pool to avoid open handle warnings in Jest
  await db.end();
});

describe('Promo Code API Endpoints', () => {
  test('POST /api/promo/validate - Should validate a correct, active promo code', async () => {
    const res = await request(app)
      .post('/api/promo/validate')
      .send({ code: 'WELCOME10' });

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('promo');
    expect(res.body.promo).toHaveProperty('code', 'WELCOME10');
    expect(res.body.promo).toHaveProperty('discount_type', 'percentage');
    expect(res.body.promo).toHaveProperty('discount_value', 10.00);
  });

  test('POST /api/promo/validate - Should fail for a non-existent promo code', async () => {
    const res = await request(app)
      .post('/api/promo/validate')
      .send({ code: 'NONEXISTENT' });

    expect(res.status).toBe(404);
    expect(res.body.error).toHaveProperty('message', 'Invalid promo code.');
  });

  test('POST /api/promo/validate - Should fail if promo code is missing in body', async () => {
    const res = await request(app)
      .post('/api/promo/validate')
      .send({});

    expect(res.status).toBe(400);
    expect(res.body.error).toHaveProperty('message', 'Promo code is required.');
  });
});
