const db = require('../config/db');
const crypto = require('crypto');
const jwt = require('jsonwebtoken');

// Password hash helper
function hashPassword(password) {
  return crypto.createHash('sha256').update(password).digest('hex');
}

exports.register = async (req, res, next) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ error: { message: 'Email and password are required.' } });
  }

  try {
    // Check if user already exists
    const [existing] = await db.query('SELECT id FROM users WHERE email = ?', [email]);
    if (existing.length > 0) {
      return res.status(400).json({ error: { message: 'Email is already registered.' } });
    }

    const hashedPassword = hashPassword(password);
    const [result] = await db.query(
      'INSERT INTO users (email, password_hash, role) VALUES (?, ?, ?)',
      [email, hashedPassword, 'customer']
    );

    const token = jwt.sign(
      { id: result.insertId, email, role: 'customer' },
      process.env.JWT_SECRET || 'fallback_secret',
      { expiresIn: '24h' }
    );

    res.status(201).json({
      message: 'User registered successfully.',
      token,
      user: { id: result.insertId, email, role: 'customer' }
    });
  } catch (error) {
    next(error);
  }
};

exports.login = async (req, res, next) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ error: { message: 'Email and password are required.' } });
  }

  try {
    const [users] = await db.query('SELECT * FROM users WHERE email = ?', [email]);
    if (users.length === 0) {
      return res.status(401).json({ error: { message: 'Invalid credentials.' } });
    }

    const user = users[0];
    if (!user.is_active) {
      return res.status(403).json({ error: { message: 'Account is deactivated.' } });
    }

    const hashedPassword = hashPassword(password);
    if (user.password_hash !== hashedPassword) {
      return res.status(401).json({ error: { message: 'Invalid credentials.' } });
    }

    const token = jwt.sign(
      { id: user.id, email: user.email, role: user.role },
      process.env.JWT_SECRET || 'fallback_secret',
      { expiresIn: '24h' }
    );

    res.status(200).json({
      message: 'Login successful.',
      token,
      user: { id: user.id, email: user.email, role: user.role }
    });
  } catch (error) {
    next(error);
  }
};

exports.getProfile = async (req, res, next) => {
  try {
    const [users] = await db.query(
      'SELECT id, email, role, is_active, created_at FROM users WHERE id = ?',
      [req.user.id]
    );

    if (users.length === 0) {
      return res.status(404).json({ error: { message: 'User not found.' } });
    }

    const user = users[0];

    // Fetch associated address details
    const [addresses] = await db.query(
      'SELECT id, address_type, recipient_name, street_address, city, state, postal_code, phone_number FROM user_addresses WHERE user_id = ?',
      [req.user.id]
    );

    res.status(200).json({
      user,
      addresses
    });
  } catch (error) {
    next(error);
  }
};
