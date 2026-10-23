import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { q } from '../db.js';
import { sign, auth, h } from '../auth.js';
const r = Router();
const pub = (u) => ({ id: u.id, name: u.name, email: u.email, role: u.role });

r.post('/register', h(async (req, res) => {
  const { name, email, password } = req.body;
  if (!name || !email || !password || password.length < 6)
    return res.status(400).json({ error: 'Name, email and a 6+ char password are required' });
  const exists = await q('SELECT 1 FROM users WHERE email=$1', [email.toLowerCase()]);
  if (exists.length) return res.status(409).json({ error: 'Email already registered' });
  const [u] = await q(
    `INSERT INTO users(name,email,password_hash,role) VALUES($1,$2,$3,'student') RETURNING *`,
    [name, email.toLowerCase(), bcrypt.hashSync(password, 10)]
  );
  res.json({ token: sign(u), user: pub(u) });
}));

r.post('/login', h(async (req, res) => {
  const { email, password } = req.body;
  const [u] = await q('SELECT * FROM users WHERE email=$1', [(email || '').toLowerCase()]);
  if (!u || !bcrypt.compareSync(password || '', u.password_hash))
    return res.status(401).json({ error: 'Invalid email or password' });
  res.json({ token: sign(u), user: pub(u) });
}));

r.get('/me', auth, h(async (req, res) => {
  const [u] = await q('SELECT * FROM users WHERE id=$1', [req.user.id]);
  u ? res.json(pub(u)) : res.status(401).json({ error: 'Unknown user' });
}));

export default r;
