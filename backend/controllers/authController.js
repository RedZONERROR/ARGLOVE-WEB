const db = require('../config/db');
const jwt = require('jsonwebtoken');
const nodemailer = require('nodemailer');
const { hashPassword, verifyPassword, needsRehash } = require('../utils/password');
const { getJwtSecret } = require('../config/security');

function signToken(user) {
  return jwt.sign(
    { id: user.id, email: user.email, role: user.role },
    getJwtSecret(),
    { expiresIn: '24h' }
  );
}

exports.register = async (req, res, next) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ error: { message: 'Email and password are required.' } });
  }

  if (password.length < 8) {
    return res.status(400).json({ error: { message: 'Password must be at least 8 characters.' } });
  }

  try {
    const [existing] = await db.query('SELECT id FROM users WHERE email = ?', [email]);
    if (existing.length > 0) {
      return res.status(400).json({ error: { message: 'Email is already registered.' } });
    }

    const hashedPassword = await hashPassword(password);
    const [result] = await db.query(
      'INSERT INTO users (email, password_hash, role) VALUES (?, ?, ?)',
      [email, hashedPassword, 'customer']
    );

    const user = { id: result.insertId, email, role: 'customer' };
    const token = signToken(user);

    res.status(201).json({
      message: 'User registered successfully.',
      token,
      user,
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

    const valid = await verifyPassword(password, user.password_hash);
    if (!valid) {
      return res.status(401).json({ error: { message: 'Invalid credentials.' } });
    }

    if (needsRehash(user.password_hash)) {
      const newHash = await hashPassword(password);
      await db.query('UPDATE users SET password_hash = ? WHERE id = ?', [newHash, user.id]);
    }

    const token = signToken(user);

    res.status(200).json({
      message: 'Login successful.',
      token,
      user: { id: user.id, email: user.email, role: user.role },
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

    const [addresses] = await db.query(
      'SELECT id, address_type, recipient_name, street_address, city, state, postal_code, phone_number FROM user_addresses WHERE user_id = ?',
      [req.user.id]
    );

    res.status(200).json({ user, addresses });
  } catch (error) {
    next(error);
  }
};

exports.forgotPassword = async (req, res, next) => {
  const { email } = req.body;
  if (!email) {
    return res.status(400).json({ error: { message: 'Email is required.' } });
  }

  try {
    const [users] = await db.query('SELECT id FROM users WHERE email = ?', [email]);
    if (users.length === 0) {
      return res.status(404).json({ error: { message: 'User with this email does not exist.' } });
    }

    const user = users[0];
    const token = require('crypto').randomBytes(32).toString('hex');
    const expiry = new Date(Date.now() + 3600000);

    await db.query(
      'UPDATE users SET reset_token = ?, reset_token_expiry = ? WHERE id = ?',
      [token, expiry, user.id]
    );

    const resetUrl = `${process.env.FRONTEND_URL || 'http://localhost:3000'}/reset-password?token=${token}`;
    const emailBody = `You requested a password reset. Please click on the link to reset your password: ${resetUrl}`;

    const smtpHost = process.env.SMTP_HOST;
    const smtpPort = process.env.SMTP_PORT || 587;
    const smtpUser = process.env.SMTP_USER;
    const smtpPass = process.env.SMTP_PASSWORD;

    let emailSent = false;

    if (smtpHost && smtpUser && smtpPass) {
      try {
        const transporter = nodemailer.createTransport({
          host: smtpHost,
          port: parseInt(smtpPort, 10),
          auth: { user: smtpUser, pass: smtpPass },
        });

        await transporter.sendMail({
          from: process.env.EMAIL_FROM || '"ARGLOVE" <no-reply@arglove.com>',
          to: email,
          subject: 'Reset Password Request',
          text: emailBody,
          html: `<p>${emailBody}</p>`,
        });
        emailSent = true;
      } catch (mailError) {
        console.error('Nodemailer failed to send email:', mailError);
      }
    }

    if (!emailSent) {
      console.log(`\n--- PASSWORD RESET EMAIL (FALLBACK) ---\nTo: ${email}\nLink: ${resetUrl}\n---------------------------------------\n`);
      if (process.env.NODE_ENV === 'test') {
        return res.status(200).json({
          message: 'Password reset link generated (test fallback).',
          resetUrl,
          token,
        });
      }
      return res.status(200).json({
        message: 'If an account exists for this email, a reset link has been sent.',
      });
    }

    res.status(200).json({ message: 'Password reset email sent successfully.' });
  } catch (error) {
    next(error);
  }
};

exports.resetPassword = async (req, res, next) => {
  const { token, password } = req.body;
  if (!token || !password) {
    return res.status(400).json({ error: { message: 'Token and new password are required.' } });
  }

  if (password.length < 8) {
    return res.status(400).json({ error: { message: 'Password must be at least 8 characters.' } });
  }

  try {
    const [users] = await db.query(
      'SELECT id, reset_token_expiry FROM users WHERE reset_token = ?',
      [token]
    );

    if (users.length === 0) {
      return res.status(400).json({ error: { message: 'Invalid or expired token.' } });
    }

    const user = users[0];
    if (new Date(user.reset_token_expiry) < new Date()) {
      return res.status(400).json({ error: { message: 'Invalid or expired token.' } });
    }

    const hashedPassword = await hashPassword(password);
    await db.query(
      'UPDATE users SET password_hash = ?, reset_token = NULL, reset_token_expiry = NULL WHERE id = ?',
      [hashedPassword, user.id]
    );

    res.status(200).json({ message: 'Password has been reset successfully.' });
  } catch (error) {
    next(error);
  }
};
