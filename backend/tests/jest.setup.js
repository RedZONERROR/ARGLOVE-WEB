process.env.NODE_ENV = 'test';

if (!process.env.JWT_SECRET) {
  process.env.JWT_SECRET = 'test_jwt_secret_min_32_chars_long!!';
}
