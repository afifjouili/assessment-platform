import jwt from 'jsonwebtoken';
import { getDbReady } from './db';

const JWT_SECRET = process.env.JWT_SECRET || 'ngo_assessment_platform_secret_key_2024_tunisian';

function getTokenFromRequest(request) {
  const authHeader = request.headers.get('authorization') || '';
  if (!authHeader.startsWith('Bearer ')) return null;
  return authHeader.split(' ')[1];
}

/**
 * Verifies JWT and returns user. Throws with status if invalid.
 */
export async function authenticate(request) {
  const token = getTokenFromRequest(request);
  if (!token) {
    const err = new Error('Access denied. No token provided.');
    err.status = 401;
    throw err;
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    const db = await getDbReady();
    const user = db.prepare(
      'SELECT id, name, email, role, organization, created_at FROM users WHERE id = ?'
    ).get(decoded.userId);

    if (!user) {
      const err = new Error('User not found. Token invalid.');
      err.status = 401;
      throw err;
    }
    return user;
  } catch (err) {
    if (err.status) throw err;
    const e = new Error('Invalid or expired token.');
    e.status = 401;
    throw e;
  }
}

/**
 * Same as authenticate but returns null instead of throwing if no token.
 */
export async function optionalAuthenticate(request) {
  const token = getTokenFromRequest(request);
  if (!token) return null;

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    const db = await getDbReady();
    const user = db.prepare(
      'SELECT id, name, email, role, organization, created_at FROM users WHERE id = ?'
    ).get(decoded.userId);
    return user || null;
  } catch (err) {
    return null;
  }
}

export function signToken(userId) {
  return jwt.sign({ userId }, JWT_SECRET, { expiresIn: '7d' });
}

export function authError(message, status = 401) {
  return Response.json({ error: message }, { status });
}
