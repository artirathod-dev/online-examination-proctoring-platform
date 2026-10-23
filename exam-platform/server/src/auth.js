import 'dotenv/config';
import jwt from 'jsonwebtoken';
const SECRET = process.env.JWT_SECRET || 'dev-secret';
export const sign = (u) => jwt.sign({ id: u.id, role: u.role, name: u.name }, SECRET, { expiresIn: '12h' });
export const verify = (t) => jwt.verify(t, SECRET);
export function auth(req, res, next) {
  const t = (req.headers.authorization || '').replace('Bearer ', '');
  try { req.user = verify(t); next(); } catch { res.status(401).json({ error: 'Unauthorized' }); }
}
export const admin = (req, res, next) =>
  req.user.role === 'admin' ? next() : res.status(403).json({ error: 'Admins only' });
export const h = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
