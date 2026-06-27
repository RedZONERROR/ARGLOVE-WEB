const jwt = require('jsonwebtoken');
const { getJwtSecret } = require('../config/security');

module.exports = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  if (!authHeader) {
    return res.status(401).json({ error: { message: 'Access denied. No token provided.' } });
  }

  const token = authHeader.split(' ')[1];
  if (!token) {
    return res.status(401).json({ error: { message: 'Access denied. Invalid token format.' } });
  }

  try {
    const decoded = jwt.verify(token, getJwtSecret());
    req.user = decoded;
    next();
  } catch (error) {
    res.status(401).json({ error: { message: 'Invalid or expired token.' } });
  }
};
