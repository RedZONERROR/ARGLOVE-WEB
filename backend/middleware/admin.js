const db = require('../config/db');

module.exports = async (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({ error: { message: 'Access denied. Authentication required.' } });
  }

  try {
    const [users] = await db.query(
      'SELECT id, role, is_active FROM users WHERE id = ?',
      [req.user.id]
    );

    if (users.length === 0) {
      return res.status(401).json({ error: { message: 'Access denied. User not found.' } });
    }

    const user = users[0];
    if (!user.is_active) {
      return res.status(403).json({ error: { message: 'Account is deactivated.' } });
    }

    if (user.role !== 'admin') {
      return res.status(403).json({ error: { message: 'Access denied. Administrator privileges required.' } });
    }

    req.user.role = user.role;
    next();
  } catch (error) {
    next(error);
  }
};
