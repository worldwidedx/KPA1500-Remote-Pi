'use strict';

const crypto = require('node:crypto');

function hashPassword(password, salt = crypto.randomBytes(16)) {
  if (typeof password !== 'string' || password.length < 10) throw new Error('Password must be at least 10 characters');
  const hash = crypto.scryptSync(password, salt, 64, { N: 16384, r: 8, p: 1 });
  return `scrypt$16384$${salt.toString('base64')}$${hash.toString('base64')}`;
}

function verifyPassword(password, encoded) {
  try {
    const [kind, cost, saltText, hashText] = String(encoded).split('$');
    if (kind !== 'scrypt' || cost !== '16384') return false;
    const expected = Buffer.from(hashText, 'base64');
    const actual = crypto.scryptSync(password, Buffer.from(saltText, 'base64'), expected.length, { N: 16384, r: 8, p: 1 });
    return crypto.timingSafeEqual(expected, actual);
  } catch { return false; }
}

function token(bytes = 32) { return crypto.randomBytes(bytes).toString('base64url'); }

module.exports = { hashPassword, verifyPassword, token };
