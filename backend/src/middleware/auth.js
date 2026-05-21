const jwt = require('jsonwebtoken');
const { getDb } = require('../db/database');

// Middleware: verify JWT token and attach user to req
function authenticate(req, res, next) {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Access denied. No token provided.' });
  }

  const token = authHeader.split(' ')[1];

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const db = getDb();
    const user = db.prepare('SELECT id, name, email, role, organization, created_at FROM users WHERE id = ?').get(decoded.userId);

    if (!user) {
      return res.status(401).json({ error: 'User not found. Token invalid.' });
    }

    req.user = user;
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Invalid or expired token.' });
  }
}

// Middleware: check if authenticated user is admin
function requireAdmin(req, res, next) {
  if (!req.user || req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Access denied. Admin role required.' });
  }
  next();
}

// Middleware: optionally verify JWT token if present, but allow guests
function optionalAuthenticate(req, res, next) {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    req.user = null;
    return next();
  }

  const token = authHeader.split(' ')[1];

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const db = getDb();
    const user = db.prepare('SELECT id, name, email, role, organization, created_at FROM users WHERE id = ?').get(decoded.userId);

    req.user = user || null;
    next();
  } catch (err) {
    req.user = null;
    next();
  }
}

module.exports = { authenticate, requireAdmin, optionalAuthenticate };
