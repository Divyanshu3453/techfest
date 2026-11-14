import { Router } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { pool } from '../config.js';
import { auth } from '../middleware/auth.js';

const router = Router();

const publicUser = (u) => ({
  id: u.id, name: u.name, enrollment: u.enrollment, hostel: u.hostel,
  department: u.department, role: u.role, head_department: u.head_department
});
const sign = (u) =>
  jwt.sign({ id: u.id, role: u.role, name: u.name, head_department: u.head_department }, process.env.JWT_SECRET, { expiresIn: '7d' });

router.post('/register', async (req, res) => {
  const { name, enrollment, hostel, department, password } = req.body;
  if (![name, enrollment, hostel, department, password].every((v) => typeof v === 'string' && v.trim())) {
    return res.status(400).json({ error: 'Name, enrollment, hostel, department and password are required' });
  }
  if (password.length < 6) return res.status(400).json({ error: 'Password must be at least 6 characters' });
  try {
    const hash = await bcrypt.hash(password, 10);
    const { rows } = await pool.query(
      `INSERT INTO users (name, enrollment, hostel, department, password_hash)
       VALUES ($1,$2,$3,$4,$5) RETURNING *`,
      [name.trim(), enrollment.trim().toLowerCase(), hostel.trim(), department.trim(), hash]
    );
    res.status(201).json({ token: sign(rows[0]), user: publicUser(rows[0]) });
  } catch (e) {
    if (e.code === '23505') return res.status(409).json({ error: 'This enrollment number is already registered' });
    throw e;
  }
});

router.post('/login', async (req, res) => {
  const { enrollment, password } = req.body;
  const { rows } = await pool.query('SELECT * FROM users WHERE enrollment = $1', [String(enrollment || '').trim().toLowerCase()]);
  const u = rows[0];
  if (!u || !(await bcrypt.compare(String(password || ''), u.password_hash))) {
    return res.status(401).json({ error: 'Enrollment number or password is incorrect' });
  }
  res.json({ token: sign(u), user: publicUser(u) });
});

router.get('/me', auth(), async (req, res) => {
  const { rows } = await pool.query('SELECT * FROM users WHERE id = $1', [req.user.id]);
  if (!rows[0]) return res.status(404).json({ error: 'User not found' });
  res.json(publicUser(rows[0]));
});

export default router;
