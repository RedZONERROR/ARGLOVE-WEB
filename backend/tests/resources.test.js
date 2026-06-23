const request = require('supertest');
const app = require('../app');
const db = require('../config/db');
const path = require('path');
const fs = require('fs').promises;
const fssync = require('fs');

const resourceUser = {
  email: 'resourceuser@example.com',
  password: 'resourcepassword123'
};

let userToken = '';
let activeProductId = null;
let uploadedResourceId = null;
let uploadedFileName = '';

beforeAll(async () => {
  // Clear any existing test data
  const [users] = await db.query('SELECT id FROM users WHERE email = ?', [resourceUser.email]);
  if (users.length > 0) {
    const userId = users[0].id;
    // Clear dependent resources
    await db.query('DELETE FROM resources WHERE owner_type = "User" AND owner_id = ?', [userId]);
    await db.query('DELETE FROM users WHERE id = ?', [userId]);
  }

  // Register user to get a token
  const registerRes = await request(app)
    .post('/api/auth/register')
    .send(resourceUser);
  userToken = registerRes.body.token;

  // Retrieve an active product ID dynamically
  const productsRes = await request(app).get('/api/products');
  if (productsRes.body.products.length > 0) {
    activeProductId = productsRes.body.products[0].id;
  }
});

afterAll(async () => {
  // Cleanup test user
  const [users] = await db.query('SELECT id FROM users WHERE email = ?', [resourceUser.email]);
  if (users.length > 0) {
    const userId = users[0].id;
    await db.query('DELETE FROM resources WHERE owner_type = "User" AND owner_id = ?', [userId]);
    await db.query('DELETE FROM users WHERE id = ?', [userId]);
  }
  
  // Close database pool to avoid open handle warnings in Jest
  await db.end();
});

describe('Resource Management API Endpoints (Authenticated)', () => {
  test('POST /api/resources/upload - Should fail if no file is attached', async () => {
    const res = await request(app)
      .post('/api/resources/upload')
      .set('Authorization', `Bearer ${userToken}`)
      .field('owner_type', 'Product')
      .field('owner_id', activeProductId || 1);

    expect(res.status).toBe(400);
    expect(res.body.error).toHaveProperty('message', 'No file uploaded.');
  });

  test('POST /api/resources/upload - Should fail if owner details are missing', async () => {
    const dummyBuffer = Buffer.from('fake image data');

    const res = await request(app)
      .post('/api/resources/upload')
      .set('Authorization', `Bearer ${userToken}`)
      .attach('file', dummyBuffer, 'test_image.png');

    expect(res.status).toBe(400);
    expect(res.body.error).toHaveProperty('message', 'owner_type and owner_id are required.');
  });

  test('POST /api/resources/upload - Should successfully upload and map an image', async () => {
    if (!activeProductId) {
      console.warn('Skipping test: No active product ID found.');
      return;
    }

    const dummyBuffer = Buffer.from('fake png image contents');

    const res = await request(app)
      .post('/api/resources/upload')
      .set('Authorization', `Bearer ${userToken}`)
      .attach('file', dummyBuffer, 'test_image.png')
      .field('owner_type', 'Product')
      .field('owner_id', activeProductId)
      .field('file_role', 'gallery');

    expect(res.status).toBe(201);
    expect(res.body).toHaveProperty('message', 'Resource uploaded and registered successfully.');
    expect(res.body.resource).toHaveProperty('id');
    expect(res.body.resource).toHaveProperty('file_name');
    expect(res.body.resource).toHaveProperty('mime_type', 'image/png');
    expect(res.body.resource).toHaveProperty('owner_type', 'Product');
    expect(res.body.resource).toHaveProperty('owner_id', activeProductId);
    expect(res.body.resource.file_url).toContain('/uploads/');

    uploadedResourceId = res.body.resource.id;
    uploadedFileName = res.body.resource.file_name;

    // Verify physical file was written to disk
    const filePath = path.join(__dirname, '..', 'public', 'uploads', uploadedFileName);
    const fileExists = fssync.existsSync(filePath);
    expect(fileExists).toBe(true);
  });

  test('DELETE /api/resources/:id - Should successfully delete resource record and disk file', async () => {
    if (!uploadedResourceId) return;

    const res = await request(app)
      .delete(`/api/resources/${uploadedResourceId}`)
      .set('Authorization', `Bearer ${userToken}`);

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('message', 'Resource deleted successfully.');

    // Verify database record is gone
    const [rows] = await db.query('SELECT * FROM resources WHERE id = ?', [uploadedResourceId]);
    expect(rows.length).toBe(0);

    // Verify physical file was removed from the disk
    const filePath = path.join(__dirname, '..', 'public', 'uploads', uploadedFileName);
    const fileExists = fssync.existsSync(filePath);
    expect(fileExists).toBe(false);
  });

  test('DELETE /api/resources/:id - Should return 404 for invalid ID', async () => {
    const res = await request(app)
      .delete('/api/resources/999999')
      .set('Authorization', `Bearer ${userToken}`);

    expect(res.status).toBe(404);
    expect(res.body.error).toHaveProperty('message', 'Resource not found.');
  });
});
