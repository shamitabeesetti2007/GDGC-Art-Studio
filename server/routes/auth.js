const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const db = require('../db/init');
const { authRequired } = require('../middleware/auth');

const router = express.Router();
const JWT_SECRET = process.env.JWT_SECRET;
const COOKIE_SAME_SITE = process.env.COOKIE_SAME_SITE || (process.env.NODE_ENV === 'production' ? 'none' : 'lax');
const COOKIE_OPTIONS = {
  httpOnly: true,
  sameSite: COOKIE_SAME_SITE,
  secure: process.env.NODE_ENV === 'production' || COOKIE_SAME_SITE === 'none',
  maxAge: 7 * 24 * 60 * 60 * 1000
};

function setSessionCookie(res, token) {
  res.cookie('jwt', token, COOKIE_OPTIONS);
}

// POST /api/auth/signup
router.post('/signup', (req, res) => {
  const { name, email, password } = req.body || {};
  const normalizedEmail = typeof email === 'string' ? email.trim().toLowerCase() : '';
  const normalizedName = typeof name === 'string' ? name.trim() : '';

  if (!normalizedName || !normalizedEmail || typeof password !== 'string' || !password) {
    return res.status(400).json({
      error: { code: 'VALIDATION_ERROR', message: 'Name, email, and password are required.' }
    });
  }

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
    return res.status(400).json({
      error: { code: 'VALIDATION_ERROR', message: 'Please enter a valid email address.' }
    });
  }

  if (password.length < 8) {
    return res.status(400).json({
      error: { code: 'VALIDATION_ERROR', message: 'Password must be at least 8 characters.' }
    });
  }

  try {
    const hash = bcrypt.hashSync(password, 10);
    const user = db.prepare(
      `INSERT INTO users (name, email, password_hash, role) VALUES (?, ?, ?, 'customer') RETURNING *`
    ).get(normalizedName, normalizedEmail, hash);

    const token = jwt.sign({ id: user.id, email: user.email, role: user.role }, JWT_SECRET, { expiresIn: '7d' });
    setSessionCookie(res, token);
    res.status(201).json({
      user: { id: user.id, name: user.name, email: user.email, role: user.role }
    });
  } catch (err) {
    if (err.message.includes('UNIQUE constraint')) {
      return res.status(409).json({
        error: { code: 'DUPLICATE_EMAIL', message: 'An account with this email already exists.' }
      });
    }
    throw err;
  }
});

// POST /api/auth/login
router.post('/login', (req, res) => {
  const { email, password } = req.body || {};
  const normalizedEmail = typeof email === 'string' ? email.trim().toLowerCase() : '';

  if (!normalizedEmail || typeof password !== 'string' || !password) {
    return res.status(400).json({
      error: { code: 'VALIDATION_ERROR', message: 'Email and password are required.' }
    });
  }

  const user = db.prepare('SELECT * FROM users WHERE email = ?').get(normalizedEmail);
  if (!user || !bcrypt.compareSync(password, user.password_hash)) {
    return res.status(401).json({
      error: { code: 'INVALID_CREDENTIALS', message: 'Email or password is incorrect.' }
    });
  }

  const token = jwt.sign({ id: user.id, email: user.email, role: user.role }, JWT_SECRET, { expiresIn: '7d' });
  setSessionCookie(res, token);
  res.json({
    user: { id: user.id, name: user.name, email: user.email, role: user.role }
  });
});

// POST /api/auth/logout
router.post('/logout', (req, res) => {
  res.clearCookie('jwt', {
    httpOnly: true,
    sameSite: COOKIE_SAME_SITE,
    secure: COOKIE_OPTIONS.secure
  });
  res.json({ message: 'Logged out successfully.' });
});

// GET /api/auth/me
router.get('/me', authRequired, (req, res) => {
  const user = db.prepare('SELECT id, name, email, role, created_at FROM users WHERE id = ?').get(req.user.id);
  if (!user) {
    return res.status(404).json({
      error: { code: 'NOT_FOUND', message: 'User not found.' }
    });
  }
  res.json({ user });
});

module.exports = router;
