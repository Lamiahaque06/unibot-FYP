/**
 * authUtils.test.js
 * Unit tests for JWT utility functions (generateToken, verifyToken,
 * generateUserToken, decodeToken)
 */

process.env.JWT_SECRET = 'test_secret_for_unit_tests';
process.env.JWT_EXPIRE = '7d';

const { generateToken, verifyToken, generateUserToken, decodeToken } = require('../utils/jwt');

describe('JWT Utilities', () => {
  // ── generateToken ────────────────────────────────────────────────────────
  describe('generateToken', () => {
    it('returns a non-empty string', () => {
      const token = generateToken({ id: '123' });
      expect(typeof token).toBe('string');
      expect(token.length).toBeGreaterThan(0);
    });

    it('produces a token with three dot-separated segments (header.payload.signature)', () => {
      const token = generateToken({ id: '123' });
      expect(token.split('.').length).toBe(3);
    });

    it('encodes the supplied payload fields', () => {
      const token = generateToken({ id: 'abc', role: 'admin' });
      const decoded = decodeToken(token);
      expect(decoded.id).toBe('abc');
      expect(decoded.role).toBe('admin');
    });

    it('respects a custom expiry string', () => {
      const token = generateToken({ id: '1' }, '1h');
      const decoded = decodeToken(token);
      const nowSec = Math.floor(Date.now() / 1000);
      expect(decoded.exp).toBeGreaterThan(nowSec);
      // exp should be ~3600 s from now (allow ±10 s for test execution time)
      expect(decoded.exp - nowSec).toBeLessThanOrEqual(3610);
    });
  });

  // ── verifyToken ──────────────────────────────────────────────────────────
  describe('verifyToken', () => {
    it('returns the decoded payload for a valid token', () => {
      const token = generateToken({ id: 'u1', email: 'a@b.com' });
      const decoded = verifyToken(token);
      expect(decoded.id).toBe('u1');
      expect(decoded.email).toBe('a@b.com');
    });

    it('throws "Invalid token" for a tampered token', () => {
      const token = generateToken({ id: 'u2' });
      const tampered = token.slice(0, -3) + 'xyz';
      expect(() => verifyToken(tampered)).toThrow('Invalid token');
    });

    it('throws "Token has expired" for an already-expired token', () => {
      const token = generateToken({ id: 'u3' }, '0s');
      // Wait 1 ms so the token is in the past
      return new Promise((resolve) => setTimeout(resolve, 50)).then(() => {
        expect(() => verifyToken(token)).toThrow('Token has expired');
      });
    });

    it('throws for a completely invalid string', () => {
      expect(() => verifyToken('not.a.token')).toThrow();
    });
  });

  // ── generateUserToken ────────────────────────────────────────────────────
  describe('generateUserToken', () => {
    it('encodes id, email, and role from the user object', () => {
      const fakeUser = { _id: 'user99', email: 'user@uni.ac.uk', role: 'student' };
      const token = generateUserToken(fakeUser);
      const decoded = verifyToken(token);
      expect(decoded.id).toBe('user99');
      expect(decoded.email).toBe('user@uni.ac.uk');
      expect(decoded.role).toBe('student');
    });

    it('does NOT include the password field', () => {
      const fakeUser = { _id: 'u5', email: 'x@y.com', role: 'admin', password: 'secret' };
      const token = generateUserToken(fakeUser);
      const decoded = decodeToken(token);
      expect(decoded.password).toBeUndefined();
    });
  });

  // ── decodeToken ──────────────────────────────────────────────────────────
  describe('decodeToken', () => {
    it('decodes without verifying signature', () => {
      const token = generateToken({ id: 'any' });
      const decoded = decodeToken(token);
      expect(decoded.id).toBe('any');
    });

    it('returns null for a completely invalid string', () => {
      const result = decodeToken('garbage');
      expect(result).toBeNull();
    });
  });
});
