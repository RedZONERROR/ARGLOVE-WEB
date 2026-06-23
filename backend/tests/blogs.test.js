const request = require('supertest');
const app = require('../app');
const db = require('../config/db');

const blogUser = {
  email: 'bloguser@example.com',
  password: 'blogpassword123'
};

let userToken = '';
let activeBlogId = null;

async function cleanupUser(email) {
  const [users] = await db.query('SELECT id FROM users WHERE email = ?', [email]);
  if (users.length > 0) {
    const userId = users[0].id;
    // Delete blog comments made by this user
    await db.query('DELETE FROM blog_comments WHERE user_id = ?', [userId]);
    // Delete user
    await db.query('DELETE FROM users WHERE id = ?', [userId]);
  }
}

beforeAll(async () => {
  // Clear any existing test user & comments
  await cleanupUser(blogUser.email);

  // Register the user to get a token
  const registerRes = await request(app)
    .post('/api/auth/register')
    .send(blogUser);
  userToken = registerRes.body.token;

  // Retrieve an active blog ID dynamically from seeded posts
  const blogsRes = await request(app).get('/api/blogs');
  if (blogsRes.body.blogs.length > 0) {
    activeBlogId = blogsRes.body.blogs[0].id;
  }
});

afterAll(async () => {
  // Cleanup test user
  await cleanupUser(blogUser.email);
  // Close database pool to avoid open handle warnings in Jest
  await db.end();
});

describe('Blogs and Comments API Endpoints', () => {
  test('GET /api/blogs - Should retrieve list of published blogs', async () => {
    const res = await request(app)
      .get('/api/blogs');

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('blogs');
    expect(Array.isArray(res.body.blogs)).toBe(true);
    expect(res.body.blogs.length).toBeGreaterThan(0);
  });

  test('GET /api/blogs/:id - Should retrieve details of a specific blog post', async () => {
    if (!activeBlogId) {
      console.warn('Skipping test: No active blog ID found.');
      return;
    }

    const res = await request(app)
      .get(`/api/blogs/${activeBlogId}`);

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('blog');
    expect(res.body.blog.id).toBe(activeBlogId);
    expect(res.body).toHaveProperty('comments');
    expect(Array.isArray(res.body.comments)).toBe(true);
  });

  test('POST /api/blogs/:id/comment - Should fail without authentication', async () => {
    if (!activeBlogId) return;

    const res = await request(app)
      .post(`/api/blogs/${activeBlogId}/comment`)
      .send({ comment_body: 'Great writeup!' });

    expect(res.status).toBe(401);
  });

  test('POST /api/blogs/:id/comment - Should successfully post comment when authenticated', async () => {
    if (!activeBlogId) return;

    const commentText = 'Fabulous blog post, thanks for sharing!';
    const res = await request(app)
      .post(`/api/blogs/${activeBlogId}/comment`)
      .set('Authorization', `Bearer ${userToken}`)
      .send({ comment_body: commentText });

    expect(res.status).toBe(201);
    expect(res.body).toHaveProperty('message', 'Comment added successfully.');
    expect(res.body).toHaveProperty('comment_id');

    // Verify it is added in blog details
    const checkRes = await request(app)
      .get(`/api/blogs/${activeBlogId}`);
    
    expect(checkRes.status).toBe(200);
    const addedComment = checkRes.body.comments.find(c => c.comment_body === commentText);
    expect(addedComment).toBeDefined();
    expect(addedComment.user_email).toBe(blogUser.email);
  });

  test('GET /api/blogs/:id - Should return 404 for invalid blog post ID', async () => {
    const res = await request(app)
      .get('/api/blogs/999999');

    expect(res.status).toBe(404);
    expect(res.body.error).toHaveProperty('message', 'Blog post not found.');
  });
});
