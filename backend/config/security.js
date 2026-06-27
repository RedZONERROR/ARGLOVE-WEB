function getJwtSecret() {
  if (process.env.NODE_ENV === 'test') {
    return process.env.JWT_SECRET || 'test_jwt_secret_min_32_chars_long!!';
  }
  const secret = process.env.JWT_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error('JWT_SECRET must be set in environment and be at least 32 characters.');
  }
  return secret;
}

function validateSecurityConfig() {
  if (process.env.NODE_ENV === 'test') return;

  getJwtSecret();

  if (process.env.NODE_ENV === 'production') {
    const webhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET;
    if (!webhookSecret || webhookSecret.includes('your_') || webhookSecret.startsWith('mock_')) {
      console.warn('WARNING: RAZORPAY_WEBHOOK_SECRET is not configured for production.');
    }
    if (String(process.env.FORCE_MOCK_RAZORPAY || '').toLowerCase() === 'true') {
      throw new Error('FORCE_MOCK_RAZORPAY must not be enabled in production.');
    }
  }
}

function isDevMode() {
  return process.env.NODE_ENV !== 'production';
}

function getCorsOrigins() {
  const raw =
    process.env.CORS_ORIGINS ||
    process.env.FRONTEND_URL ||
    'http://localhost:5173,http://localhost:3000';
  return raw.split(',').map((s) => s.trim()).filter(Boolean);
}

module.exports = { getJwtSecret, validateSecurityConfig, isDevMode, getCorsOrigins };
