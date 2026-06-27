const jwt = require('jsonwebtoken');
const { getJwtSecret } = require('../config/security');

/** Sets req.user when a valid token is present; otherwise continues anonymously. */
module.exports = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  if (!authHeader) return next();

  const token = authHeader.split(' ')[1];
  if (!token) return next();

  try {
    req.user = jwt.verify(token, getJwtSecret());
  } catch {
    // ignore invalid optional token
  }
  next();
};
