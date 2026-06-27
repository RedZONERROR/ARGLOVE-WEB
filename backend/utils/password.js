const bcrypt = require('bcrypt');
const crypto = require('crypto');

const SALT_ROUNDS = 12;

function isLegacySha256(hash) {
  return typeof hash === 'string' && /^[a-f0-9]{64}$/i.test(hash);
}

function legacySha256(password) {
  return crypto.createHash('sha256').update(password).digest('hex');
}

async function hashPassword(password) {
  return bcrypt.hash(password, SALT_ROUNDS);
}

async function verifyPassword(password, storedHash) {
  if (!storedHash) return false;
  if (storedHash.startsWith('$2')) {
    return bcrypt.compare(password, storedHash);
  }
  if (isLegacySha256(storedHash)) {
    return legacySha256(password) === storedHash;
  }
  return false;
}

function needsRehash(storedHash) {
  return isLegacySha256(storedHash);
}

module.exports = { hashPassword, verifyPassword, needsRehash, legacySha256 };
