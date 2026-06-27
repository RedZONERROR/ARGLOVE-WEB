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

/** Minimal valid 1x1 PNG for upload magic-byte validation */
const MINI_PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAAD0lEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
  'base64'
);

let userToken = '';
let userId = null;
let uploadedResourceId = null;
let uploadedFileName = '';

beforeAll(async () => {
  const [users] = await db.query('SELECT id FROM users WHERE email = ?', [resourceUser.email]);
  if (users.length > 0) {
    const uid = users[0].id;
    await db.query('DELETE FROM resources WHERE owner_type = "User" AND owner_id = ?', [uid]);
    await db.query('DELETE FROM users WHERE id = ?', [uid]);
  }

  const registerRes = await request(app)
    .post('/api/auth/register')
    .send(resourceUser);
  userToken = registerRes.body.token;
  userId = registerRes.body.user.id;
});

afterAll(async () => {
  const [users] = await db.query('SELECT id FROM users WHERE email = ?', [resourceUser.email]);
  if (users.length > 0) {
    const uid = users[0].id;
    await db.query('DELETE FROM resources WHERE owner_type = "User" AND owner_id = ?', [uid]);
    await db.query('DELETE FROM users WHERE id = ?', [uid]);
  }

  await db.end();
});

describe('Resource Management API Endpoints (Authenticated)', () => {
  test('POST /api/resources/upload - Should fail if no file is attached', async () => {
    const res = await request(app)
      .post('/api/resources/upload')
      .set('Authorization', `Bearer ${userToken}`)
      .field('owner_type', 'User')
      .field('owner_id', userId);

    expect(res.status).toBe(400);
    expect(res.body.error).toHaveProperty('message', 'No file uploaded.');
  });

  test('POST /api/resources/upload - Should fail if owner details are missing', async () => {
    const res = await request(app)
      .post('/api/resources/upload')
      .set('Authorization', `Bearer ${userToken}`)
      .attach('file', MINI_PNG, 'test_image.png');

    expect(res.status).toBe(400);
    expect(res.body.error).toHaveProperty('message', 'owner_type and owner_id are required.');
  });

  test('POST /api/resources/upload - Should reject upload to Product for non-admin', async () => {
    const res = await request(app)
      .post('/api/resources/upload')
      .set('Authorization', `Bearer ${userToken}`)
      .attach('file', MINI_PNG, 'test_image.png')
      .field('owner_type', 'Product')
      .field('owner_id', 1)
      .field('file_role', 'gallery');

    expect(res.status).toBe(403);
    expect(res.body.error).toHaveProperty('message', 'You are not authorized to upload to this resource.');
  });

  test('POST /api/resources/upload - Should successfully upload avatar for own user', async () => {
    const res = await request(app)
      .post('/api/resources/upload')
      .set('Authorization', `Bearer ${userToken}`)
      .attach('file', MINI_PNG, 'test_image.png')
      .field('owner_type', 'User')
      .field('owner_id', userId)
      .field('file_role', 'avatar');

    expect(res.status).toBe(201);
    expect(res.body).toHaveProperty('message', 'Resource uploaded and registered successfully.');
    expect(res.body.resource).toHaveProperty('id');
    expect(res.body.resource).toHaveProperty('file_name');
    expect(res.body.resource).toHaveProperty('mime_type', 'image/png');
    expect(res.body.resource).toHaveProperty('owner_type', 'User');
    expect(res.body.resource).toHaveProperty('owner_id', userId);
    expect(res.body.resource.file_url).toContain('/uploads/');

    uploadedResourceId = res.body.resource.id;
    uploadedFileName = res.body.resource.file_name;

    const filePath = path.join(__dirname, '..', 'public', 'uploads', uploadedFileName);
    expect(fssync.existsSync(filePath)).toBe(true);
  });

  test('DELETE /api/resources/:id - Should successfully delete resource record and disk file', async () => {
    if (!uploadedResourceId) return;

    const res = await request(app)
      .delete(`/api/resources/${uploadedResourceId}`)
      .set('Authorization', `Bearer ${userToken}`);

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('message', 'Resource deleted successfully.');

    const [rows] = await db.query('SELECT * FROM resources WHERE id = ?', [uploadedResourceId]);
    expect(rows.length).toBe(0);

    const filePath = path.join(__dirname, '..', 'public', 'uploads', uploadedFileName);
    expect(fssync.existsSync(filePath)).toBe(false);
  });

  test('DELETE /api/resources/:id - Should return 404 for invalid ID', async () => {
    const res = await request(app)
      .delete('/api/resources/999999')
      .set('Authorization', `Bearer ${userToken}`);

    expect(res.status).toBe(404);
    expect(res.body.error).toHaveProperty('message', 'Resource not found.');
  });
});
