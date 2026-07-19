'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { hashPassword, verifyPassword } = require('../src/auth');

test('passwords use salted scrypt hashes', () => {
  const a = hashPassword('correct horse battery staple');
  const b = hashPassword('correct horse battery staple');
  assert.notEqual(a, b); assert.equal(verifyPassword('correct horse battery staple', a), true); assert.equal(verifyPassword('wrong password', a), false);
});
test('short passwords are rejected', () => assert.throws(() => hashPassword('short')));
