/**
 * validation.test.js
 * Unit tests for express-validator rule sets exposed by the validator middleware.
 *
 * Strategy: mount each validator array + the `validate` handler on a tiny
 * Express app and fire requests through supertest, then assert on the HTTP
 * response rather than calling the validators directly.
 */

const express = require('express');
const request = require('supertest');

// We need supertest — install inline guard so tests give a clear message
let supertestAvailable = true;
try { require.resolve('supertest'); } catch (_) { supertestAvailable = false; }

const {
  validateRegister,
  validateLogin,
  validateCourse,
  validateMessage,
} = require('../middleware/validator');

// ── tiny helper: mount validators on POST / and always 200 if they pass ────
function makeApp(validators) {
  const app = express();
  app.use(express.json());
  app.post('/', validators, (req, res) => res.status(200).json({ ok: true }));
  return app;
}

// ── skip gracefully if supertest is not installed ───────────────────────────
const maybeDescribe = supertestAvailable ? describe : describe.skip;

maybeDescribe('validateRegister', () => {
  const app = makeApp(validateRegister);

  it('accepts a valid registration payload', async () => {
    const res = await request(app).post('/').send({
      email: 'john@uni.ac.uk',
      password: 'Secret123',
      firstName: 'John',
      lastName: 'Doe',
    });
    expect(res.status).toBe(200);
  });

  it('rejects missing email', async () => {
    const res = await request(app).post('/').send({
      password: 'Secret123', firstName: 'A', lastName: 'B',
    });
    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });

  it('rejects an invalid email format', async () => {
    const res = await request(app).post('/').send({
      email: 'notanemail', password: 'Secret123', firstName: 'A', lastName: 'B',
    });
    expect(res.status).toBe(400);
    expect(res.body.errors.some(e => e.field === 'email')).toBe(true);
  });

  it('rejects a password shorter than 6 characters', async () => {
    const res = await request(app).post('/').send({
      email: 'a@b.com', password: '12', firstName: 'A', lastName: 'B',
    });
    expect(res.status).toBe(400);
    expect(res.body.errors.some(e => e.field === 'password')).toBe(true);
  });

  it('rejects missing firstName', async () => {
    const res = await request(app).post('/').send({
      email: 'a@b.com', password: 'Secret123', lastName: 'B',
    });
    expect(res.status).toBe(400);
    expect(res.body.errors.some(e => e.field === 'firstName')).toBe(true);
  });

  it('rejects missing lastName', async () => {
    const res = await request(app).post('/').send({
      email: 'a@b.com', password: 'Secret123', firstName: 'A',
    });
    expect(res.status).toBe(400);
    expect(res.body.errors.some(e => e.field === 'lastName')).toBe(true);
  });

  it('rejects an invalid role value', async () => {
    const res = await request(app).post('/').send({
      email: 'a@b.com', password: 'Secret123', firstName: 'A', lastName: 'B', role: 'superuser',
    });
    expect(res.status).toBe(400);
    expect(res.body.errors.some(e => e.field === 'role')).toBe(true);
  });

  it('accepts role "admin"', async () => {
    const res = await request(app).post('/').send({
      email: 'admin@uni.ac.uk', password: 'Secret123', firstName: 'Ad', lastName: 'Min', role: 'admin',
    });
    expect(res.status).toBe(200);
  });

  it('accepts role "student"', async () => {
    const res = await request(app).post('/').send({
      email: 'stu@uni.ac.uk', password: 'Secret123', firstName: 'Stu', lastName: 'Dent', role: 'student',
    });
    expect(res.status).toBe(200);
  });
});

maybeDescribe('validateLogin', () => {
  const app = makeApp(validateLogin);

  it('accepts valid login credentials', async () => {
    const res = await request(app).post('/').send({ email: 'x@y.com', password: 'pass123' });
    expect(res.status).toBe(200);
  });

  it('rejects missing password', async () => {
    const res = await request(app).post('/').send({ email: 'x@y.com' });
    expect(res.status).toBe(400);
  });

  it('rejects invalid email', async () => {
    const res = await request(app).post('/').send({ email: 'bad', password: 'pass123' });
    expect(res.status).toBe(400);
  });
});

maybeDescribe('validateCourse', () => {
  const app = makeApp(validateCourse);

  const valid = {
    courseCode: 'CS101',
    courseName: 'Intro to Computing',
    description: 'Fundamentals of computer science.',
    credits: 3,
    department: 'Computer Science',
  };

  it('accepts a fully valid course payload', async () => {
    const res = await request(app).post('/').send(valid);
    expect(res.status).toBe(200);
  });

  it('rejects missing courseCode', async () => {
    const { courseCode, ...rest } = valid;
    const res = await request(app).post('/').send(rest);
    expect(res.status).toBe(400);
    expect(res.body.errors.some(e => e.field === 'courseCode')).toBe(true);
  });

  it('rejects credits = 0 (below minimum)', async () => {
    const res = await request(app).post('/').send({ ...valid, credits: 0 });
    expect(res.status).toBe(400);
    expect(res.body.errors.some(e => e.field === 'credits')).toBe(true);
  });

  it('rejects credits = 7 (above maximum)', async () => {
    const res = await request(app).post('/').send({ ...valid, credits: 7 });
    expect(res.status).toBe(400);
    expect(res.body.errors.some(e => e.field === 'credits')).toBe(true);
  });
});
